from sys import argv
from pathlib import Path
from mutagen.id3 import ID3
from mutagen.id3._frames import TXXX
from mutagen._file import File
from playsound3 import playsound
from time import sleep, time
from pydub import AudioSegment
import math
import logging
import subprocess
from datetime import datetime
from enum import Enum
from openai import OpenAI


class Style(Enum):
    BOLD = "1"
    ITALIC = "3"
    UNDERLINE = "4"


class Color(Enum):
    RED = "31"
    GREEN = "32"
    BLUE = "34"
    YELLOW = "33"
    MAGENTA = "35"
    CYAN = "36"


try:
    import readline
except Exception:
    readline = None


def get_input(prompt):
    return input(prompt)


LOG_FORMAT = "%(asctime)s %(message)s"
LOG_PATH = f"logs/{datetime.today().strftime('%Y_%m_%d')}.log"
logging.basicConfig(filename=LOG_PATH, level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger(__name__)


def main():
    print("Checking usage and parsing inputs...")
    chapter_path, options = check_usage_and_parse_args()
    print("OK")
    print("Preparing clips...")
    prepare_clips(chapter_path)
    print("Done")
    print("Starting session")
    play_clips(chapter_path, options)


def check_usage_and_parse_args():
    # Usage text
    usage = f"""Usage: {argv[0]} <level> <text> <chapter> [options]
       or: {argv[0]} -i [options]
    Required:
        level
            01 or 02 ...
        text
            01 or 02 ...
        chapter
            01 or 02 ...
    Options:
        -i --interactive
            Prompt for level, text, chapter, and reps.
            This overrides positional arguments if provided.

        -r --reps
            How many times to repeat the clip. Expressed as a
            positive whole number  greater than 0 e.g. 1 or 2.
            The default is 1.

        --usage --help
            Show this help message."""

    # Help function
    if len(argv) == 2 and (argv[1] == "--usage" or argv[1] == "--help"):
        print("Usage info requested.")
        print(usage)
        exit(0)

    # Option defaults
    reps = 1
    interactive = False

    # Detect interactive flag
    if "-i" in argv or "--interactive" in argv:
        interactive = True

    if interactive:
        for arg in argv[1:]:
            if arg.startswith("-") and arg not in {
                "-i",
                "--interactive",
                "--help",
                "--usage",
                "-r",
                "--reps",
            }:
                print(f"Error: Unrecognized option '{arg}' with --interactive")
                print(usage)
                exit(1)

        level, level_path = prompt_for_dir("Level", Path(".."))
        text, text_path = prompt_for_dir("Text", level_path)
        chapter, chapter_path = prompt_for_dir("Chapter", text_path)
        reps = prompt_for_reps()
    else:
        # Validate args
        if len(argv) < 4:
            print("Error: Inputs invalid")
            print(usage)
            exit(1)

        # Required args
        level = argv[1]
        text = argv[2]
        chapter = argv[3]

        # Path to chapter must be a valid directory
        chapter_path = Path(f"../{level}/{text}/{chapter}")
        if not chapter_path.is_dir():
            print(
                f"Error: Invalid directory input. {str(chapter_path)} is not a valid directory."
            )
            exit(1)

        # Parse the options (process remaining args in twos)
        options = argv[4:]
        while options:
            match options[0]:
                case "-r" | "--reps":
                    if len(options) < 2:
                        raise Exception(f"Missing value for option “{options[0]}”")
                    try:
                        reps = int(options[1])
                        if reps < 1:
                            raise Exception("invalid")
                    except Exception as e:
                        print(
                            f"Error parsing option [-r/--reps]: {str(e)}. Value must be a positive whole number."
                        )
                        exit(1)
                    options = options[2:]
                case _:
                    raise Exception(f"Unrecognized option “{options[0]}”")
                    exit(1)

    return chapter_path, dict(reps=reps)


def prompt_for_dir(label, base_path):
    while True:
        value = get_input(f"{label}: ").strip()
        if value.lower() == "exit":
            print("Exiting.")
            exit(0)
        if not value:
            print(f"Error: {label} is required.")
            continue
        path = base_path / value
        if not path.is_dir():
            print(
                f"Error: Invalid directory input. {str(path)} is not a valid directory."
            )
            continue
        return value, path


def prompt_for_reps():
    while True:
        value = get_input("Reps: ").strip()
        if value.lower() == "exit":
            print("Exiting.")
            exit(0)
        if not value:
            print("Error: Reps is required.")
            continue
        try:
            reps = int(value)
            if reps < 1:
                raise Exception("invalid")
        except Exception as e:
            print(
                f"Error parsing reps: {str(e)}. Value must be a positive whole number."
            )
            continue
        return reps


def prepare_clips(chapter_path):
    trim_silence(chapter_path)


def trim_silence(chapter_path):
    clips = set()

    audio_path = chapter_path / "audio"
    if not audio_path.is_dir():
        print(f"audio path '{audio_path}' is not a valid directory.")
        exit(1)
    for file in audio_path.iterdir():
        if file.suffix == ".mp3":
            clips.add(file)

    for clip in clips:
        trimmed = check_trimmed(clip)

        if not trimmed:
            sound = AudioSegment.from_file(clip, format="mp3")

            start_trim = detect_leading_silence(sound)
            end_trim = detect_leading_silence(sound.reverse())

            duration = len(sound)
            trimmed_sound = sound[start_trim : duration - end_trim]
            trimmed_sound.export(clip, format="mp3")

            add_trimmed_tag(clip)

    return audio_path


def check_trimmed(clip):
    file = File(clip)
    if not file or not file.tags:
        return False
    for frame in file.tags.getall("TXXX"):
        if frame.desc == "silence_trimmed":
            return True

    return False


def add_trimmed_tag(clip):
    mp3_metadata = ID3(clip)
    mp3_metadata.add(TXXX(encoding=3, desc="silence_trimmed", text="True"))
    mp3_metadata.save()


def detect_leading_silence(sound, silence_threshold=-50.0, chunk_size=5):
    """
    sound is a pydub.AudioSegment
    silence_threshold in dB
    chunk_size in ms

    iterate over chunks until you find the first one with sound
    """
    trim_ms = 0  # ms

    assert chunk_size > 0  # to avoid infinite loop
    while sound[
        trim_ms : trim_ms + chunk_size
    ].dBFS < silence_threshold and trim_ms < len(sound):
        trim_ms += chunk_size

    return trim_ms


def play_clips(chapter_path, options):
    print("Waiting 5 seconds")
    sleep(5)

    clips = list()

    audio_path = chapter_path / "audio"
    for file in Path(audio_path).iterdir():
        if file.suffix == ".mp3":
            clips.append(file.name)

    sorted_clips = sort_clips(clips)

    attempt_path = chapter_path / "attempt.txt"
    with open(attempt_path, "w"):
        pass

    with open(chapter_path / "lines.txt") as f:
        lines = f.read().splitlines()
    story_text = " ".join(lines)

    session_start = time()
    score = 0

    for i, clip in enumerate(sorted_clips):
        path_to_clip = f"{audio_path}/{clip}"
        reps = options["reps"]
        attempts = []
        rep_index = 0

        while rep_index < reps:
            playsound(path_to_clip)
            while True:
                if reps > 1 and attempts:
                    print("Previous reps:")
                    for idx, attempt in enumerate(attempts, start=1):
                        print(f"{idx}: {attempt}")
                prompt = f"[{i + 1}/{len(sorted_clips)}] (rep {rep_index + 1}/{reps}) [score: {score}]"
                user_input = get_input(prompt + ": ").strip()

                if user_input.lower() == "exit":
                    return log_session(session_start, chapter_path, options, score)
                if not user_input:
                    print("Error: Input cannot be blank.")
                    continue
                if user_input.lower() == "keep":
                    if attempts:
                        if not check_attempt(lines[i], attempts[-1]):
                            score += 1
                        rep_index = reps
                        break
                    print("Error: No previous attempt to keep.")
                    continue
                if user_input.lower() == "replay":
                    score += 1
                    playsound(path_to_clip)
                    continue
                if user_input.lower() == "showdiff":
                    if attempts:
                        score += 1
                        show_diff(i, lines[i], attempts[-1])
                        continue
                    print("Error: No previous attempt to show diff for.")
                    continue
                if user_input.lower() == "tutor":
                    if attempts:
                        score += 5
                        show_tutor_feedback(story_text, lines[i], attempts[-1])
                        continue
                    print("Error: No previous attempt to tutor for.")
                    continue
                if user_input.lower() == "answer":
                    score += 5
                    print(stylize(lines[i], Color.GREEN))
                    continue
                if user_input.lower() == "help":
                    show_help()
                    continue

                if not check_attempt(lines[i], user_input):
                    padding = " " * (len(prompt) + 3 + len(user_input))
                    print(f"{padding}{stylize('✗', Color.RED)}")
                    score += 1
                    attempts.append(user_input)
                    continue

                padding = " " * (len(prompt) + 3 + len(user_input))
                print(f"{padding}{stylize('✓', Color.GREEN)}")

                attempts.append(user_input)
                rep_index += 1
                break

        if attempts:
            with open(attempt_path, "a") as attempt_file:
                attempt_file.write(attempts[-1] + "\n")

    weighted_score = score / len(clips)
    log_session(session_start, chapter_path, options, weighted_score)


def log_session(session_start, chapter_path, options, score):
    session_length = time() - session_start
    session_minutes = session_length / 60
    session_minutes_floor = math.floor(session_minutes)
    session_seconds = round((session_minutes - session_minutes_floor) * 60)

    log_message = f"Session finished | {session_minutes_floor}m {session_seconds}s | chapter: {chapter_path} | reps: {options['reps']} | score: {score}"
    logger.info(log_message)
    print(log_message)
    return log_message


def show_help():
    help_text = """
Available commands:
  replay    - Replay the audio clip
  keep      - Accept your last attempt
  exit      - End the session
  showdiff  - Show differences from correct answer
  tutor     - Get AI tutor feedback
  answer    - Show the correct answer
  help      - Show this help message
"""
    print(help_text)


def sort_clips(clips):
    """More work is needed than a simple sort() because of the way audacity names the files."""
    two_digit_clips = []
    three_digit_clips = []

    for clip in clips:
        num = clip.split("c-")[1].split(".mp3")[0]
        if int(num) < 100:
            two_digit_clips.append(clip)
        else:
            three_digit_clips.append(clip)

    sorted_clips = sorted(two_digit_clips) + sorted(three_digit_clips)

    return sorted_clips


def stylize(content, color=None, style=None):
    color_code = ""
    style_code = ""
    if color:
        color_code = color.value
    if style:
        style_code = style.value
    if style and not color:
        return f"\033[{style_code}m{content}\033[0m"
    if color and not style:
        return f"\033[{color_code}m{content}\033[0m"
    if not color and not style:
        return content
    if style and color:
        return f"\033[{color_code};{style_code}m{content}\033[0m"


def show_diff(index, line, attempt):
    label = stylize(f"Diff for line {index + 1}:", Color.YELLOW)
    diff_list = [label]  # List of strings to build the message to the user

    clean_line = clean_text(line)
    clean_attempt = clean_text(attempt)
    clean_line_uncap = clean_line
    clean_attempt_uncap = clean_attempt
    if clean_line and clean_attempt:
        clean_line_uncap = clean_line[0].lower() + clean_line[1:]
        clean_attempt_uncap = clean_attempt[0].lower() + clean_attempt[1:]

    clean_line_words = clean_line.split()
    clean_attempt_words = clean_attempt.split()
    clean_line_uncap_words = clean_line_uncap.split()
    clean_attempt_uncap_words = clean_attempt_uncap.split()

    word_count_diff = len(clean_attempt_words) - len(clean_line_words)

    if word_count_diff == 0:
        for i, word in enumerate(clean_attempt_uncap_words):
            color = Color.RED
            if word == clean_line_uncap_words[i]:
                color = Color.GREEN
            diff_list.append(stylize(clean_attempt_words[i], color))
    else:
        shorter = "attempt"
        longer = "lines"
        if word_count_diff < 0:
            word_count_diff *= -1
        else:
            shorter = "lines"
            longer = "attempt"

        if longer == "attempt":
            diff_list.append(stylize(attempt, Color.RED))
            word_count_diff_msg = f" --> {word_count_diff} too many words."
            diff_list.append(stylize(word_count_diff_msg, Color.YELLOW))
        else:
            diff_list.append(stylize(attempt, Color.RED))
            word_count_diff_msg = f" --> {word_count_diff} too few words."
            diff_list.append(stylize(word_count_diff_msg, Color.YELLOW))

    print(" ".join(filter(None, diff_list)))


def show_tutor_feedback(story_text, line, attempt):
    try:
        response = get_tutor_feedback(story_text, line, attempt)
    except Exception as e:
        print(f"Error fetching tutor feedback: {str(e)}")
        return

    markdown = f"# Tutor Feedback\n\n{response}"
    print()
    if not print_with_glow(markdown):
        print(markdown)
    print()


def print_with_glow(markdown):
    try:
        completed_proc = subprocess.run(
            ["glow", "-"],
            input=markdown,
            text=True,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError:
        return False

    if completed_proc.returncode != 0:
        stderr = (completed_proc.stderr or "").strip()
        if stderr:
            print(f"Error running glow: {stderr}")
        return False

    return True


def get_tutor_feedback(story_text, line, attempt):
    response = OpenAI().responses.create(
        model="gpt-4o-mini",
        input=[
            {
                "role": "developer",
                "content": "Assume the role of a German language tutor. Your purpose is to assist the user by writing section of study notes in which you identify and explain the relevant grammatical concept(s) and/or rule(s). Explanations should be given in English where possible.",
            },
            {
                "role": "user",
                "content": f"This is the text I am currently studying: {story_text}",
            },
            {
                "role": "user",
                "content": f"This is the line which I got wrong: {line}",
            },
            {
                "role": "user",
                "content": f"My attempt to write the line from memory was: {attempt}",
            },
        ],
    )
    return response.output_text


def clean_text(text):
    clean_text = ""
    for char in text:
        if char.isspace() or char.isalpha() or char.isnumeric():
            clean_text += char
    while "  " in clean_text:
        clean_text = clean_text.replace("  ", " ")
    if clean_text and clean_text[0] == " ":
        clean_text = clean_text[1:]
    if clean_text and clean_text[-1] == " ":
        clean_text = clean_text[:-1]
    return clean_text


def check_attempt(line, attempt):
    comp_line = clean_text(line)
    comp_attempt = clean_text(attempt)
    if not comp_line or not comp_attempt:
        return False
    comp_line = comp_line[0].lower() + comp_line[1:]
    comp_attempt = comp_attempt[0].lower() + comp_attempt[1:]
    return comp_line == comp_attempt


if __name__ == "__main__":
    main()
