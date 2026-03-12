import json
import logging
from datetime import datetime

from flask import current_app, g, jsonify, request
from pydantic import BaseModel

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None

from ..auth import error_response, require_auth
from ..db import get_db

logger = logging.getLogger(__name__)

# Pydantic models for structured tutor output
class Correction(BaseModel):
    error: str
    explanation: str
    takeaway: str

class Corrections(BaseModel):
    corrections: list[Correction]

COMMAND_TYPES = {"replay", "keep", "diff", "tutor", "answer", "help", "exit"}
SESSION_STATUSES = {"in_progress", "completed", "incomplete", "abandoned"}

HELP_COMMANDS = [
    {"name": "replay", "description": "Replay the current audio clip", "shortcut": "Alt+R"},
    {"name": "keep", "description": "Accept your latest attempt and continue", "shortcut": "Alt+K"},
    {"name": "diff", "description": "Show word-level differences from the expected line", "shortcut": "Alt+D"},
    {"name": "tutor", "description": "Request tutor help for your latest attempt", "shortcut": "Alt+T"},
    {"name": "answer", "description": "Reveal the expected answer", "shortcut": "Alt+A"},
    {"name": "help", "description": "Show available commands", "shortcut": "Alt+H"},
    {"name": "exit", "description": "Exit the current session", "shortcut": "Escape"},
]


def _parse_positive_int(value, *, default: int | None = None) -> int | None:
    if value is None:
        return default
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return default
        if not text.isdigit():
            return None
        parsed = int(text)
        return parsed if parsed > 0 else None
    return None


def _parse_iso_date(value) -> str | None:
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    if not candidate:
        return None
    try:
        parsed = datetime.strptime(candidate, "%Y-%m-%d")
    except ValueError:
        return None
    return parsed.strftime("%Y-%m-%d")


def _clean_text(value: str) -> str:
    cleaned = ""
    for char in value:
        if char.isspace() or char.isalpha() or char.isnumeric():
            cleaned += char
    while "  " in cleaned:
        cleaned = cleaned.replace("  ", " ")
    if cleaned and cleaned[0] == " ":
        cleaned = cleaned[1:]
    if cleaned and cleaned[-1] == " ":
        cleaned = cleaned[:-1]
    return cleaned


def _check_attempt(line_text: str, attempt_text: str) -> bool:
    comp_line = _clean_text(line_text)
    comp_attempt = _clean_text(attempt_text)
    if not comp_line or not comp_attempt:
        return False
    comp_line = comp_line[0].lower() + comp_line[1:]
    comp_attempt = comp_attempt[0].lower() + comp_attempt[1:]
    return comp_line == comp_attempt


def _get_scoring_rule(db, key: str, *, fallback: float) -> float:
    row = db.execute("SELECT points FROM scoring_rules WHERE key = ?", (key,)).fetchone()
    if row is None:
        return fallback
    try:
        return float(row["points"])
    except (TypeError, ValueError):
        return fallback


def _get_owned_text_for_session(text_id: int):
    db = get_db()
    return db.execute(
        """
        SELECT id, name, level, is_ready, line_count, clip_count
        FROM texts
        WHERE id = ? AND user_id = ?
        """,
        (text_id, g.current_user["id"]),
    ).fetchone()


def _get_owned_session(session_id: int):
    db = get_db()
    return db.execute(
        """
        SELECT
          se.id,
          se.text_id,
          se.reps,
          se.status,
          se.started_at,
          se.ended_at,
          se.duration_seconds,
          se.raw_score,
          se.weighted_score,
          se.total_clips,
          se.current_clip_index,
          se.metadata_json,
          t.name AS text_name,
          t.level AS text_level
        FROM sessions se
        JOIN texts t ON t.id = se.text_id
        WHERE se.id = ? AND se.user_id = ?
        """,
        (session_id, g.current_user["id"]),
    ).fetchone()


def _load_text_lines(text_id: int) -> dict[int, dict]:
    db = get_db()
    rows = db.execute(
        """
        SELECT id, line_index, line_text
        FROM text_lines
        WHERE text_id = ?
        ORDER BY line_index ASC
        """,
        (text_id,),
    ).fetchall()
    return {
        int(row["line_index"]): {
            "id": int(row["id"]),
            "index": int(row["line_index"]),
            "text": row["line_text"],
        }
        for row in rows
    }


def _load_attempts(session_id: int) -> list[dict]:
    db = get_db()
    rows = db.execute(
        """
        SELECT
          sa.id,
          sa.text_line_id,
          sa.clip_index,
          sa.rep_index,
          sa.attempt_text,
          sa.is_correct,
          sa.created_at,
          tl.line_text AS expected_line_text
        FROM session_attempts sa
        LEFT JOIN text_lines tl ON tl.id = sa.text_line_id
        WHERE sa.session_id = ?
        ORDER BY sa.id ASC
        """,
        (session_id,),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "textLineId": row["text_line_id"],
            "clipIndex": row["clip_index"],
            "repIndex": row["rep_index"],
            "attemptText": row["attempt_text"],
            "isCorrect": bool(row["is_correct"]),
            "expectedLineText": row["expected_line_text"],
            "createdAt": row["created_at"],
        }
        for row in rows
    ]


def _load_session_events(session_id: int, *, limit: int = 200) -> list[dict]:
    db = get_db()
    rows = db.execute(
        """
        SELECT id, clip_index, event_type, points_delta, payload_json, created_at
        FROM session_events
        WHERE session_id = ?
        ORDER BY id ASC
        LIMIT ?
        """,
        (session_id, limit),
    ).fetchall()

    events: list[dict] = []
    for row in rows:
        payload = None
        if row["payload_json"]:
            try:
                parsed = json.loads(row["payload_json"])
                if isinstance(parsed, dict):
                    payload = parsed
            except (TypeError, json.JSONDecodeError):
                payload = None

        events.append(
            {
                "id": int(row["id"]),
                "clipIndex": int(row["clip_index"]),
                "eventType": row["event_type"],
                "pointsDelta": float(row["points_delta"]),
                "payload": payload,
                "createdAt": row["created_at"],
            }
        )
    return events


def _load_tutor_feedback_history(session_id: int, *, limit: int = 10) -> list[dict]:
    db = get_db()
    rows = db.execute(
        """
        SELECT id, clip_index, attempt_text, line_text, model_name, response_data, created_at
        FROM tutor_feedback
        WHERE session_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (session_id, limit),
    ).fetchall()

    result = []
    for row in rows:
        # Parse the JSON response_data
        response_data = row["response_data"]
        try:
            corrections = json.loads(response_data) if response_data else {"corrections": []}
        except json.JSONDecodeError:
            corrections = {"corrections": []}

        result.append({
            "id": int(row["id"]),
            "clipIndex": int(row["clip_index"]),
            "attemptText": row["attempt_text"],
            "lineText": row["line_text"],
            "modelName": row["model_name"],
            "corrections": corrections.get("corrections", []),
            "createdAt": row["created_at"],
        })

    return result


def _latest_attempt_for_position(session_id: int, *, clip_index: int, rep_index: int):
    db = get_db()
    return db.execute(
        """
        SELECT id, attempt_text, is_correct
        FROM session_attempts
        WHERE session_id = ? AND clip_index = ? AND rep_index = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (session_id, clip_index, rep_index),
    ).fetchone()


def _parse_session_metadata(metadata_json: str | None) -> dict:
    if not metadata_json:
        return {}
    try:
        data = json.loads(metadata_json)
    except (TypeError, json.JSONDecodeError):
        return {}
    if not isinstance(data, dict):
        return {}
    return data


def _text_body_from_lines(text_id: int) -> str:
    db = get_db()
    rows = db.execute(
        """
        SELECT line_text
        FROM text_lines
        WHERE text_id = ?
        ORDER BY line_index ASC
        """,
        (text_id,),
    ).fetchall()
    return "\n".join(str(row["line_text"]) for row in rows if row["line_text"])


def _openai_tutor_response(*, text_body: str, line_text: str, attempt_text: str) -> tuple[Corrections, str]:
    api_key = (current_app.config.get("OPENAI_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    if OpenAI is None:
        raise RuntimeError("openai package is not installed")

    model_name = (current_app.config.get("OPENAI_TUTOR_MODEL") or "gpt-4o-mini").strip()
    if not model_name:
        model_name = "gpt-4o-mini"

    client = OpenAI(api_key=api_key)
    response = client.responses.parse(
        model=model_name,
        input=[
            {
                "role": "developer",
                "content": (
                    "You are a concise German language tutor. Compare the user's attempt with the correct answer and provide brief, targeted feedback."
                ),
            },
            {"role": "user", "content": f"This is the text I am currently studying: {text_body}"},
            {"role": "user", "content": f"This is the line which I got wrong: {line_text}"},
            {"role": "user", "content": f"My attempt to write the line from memory was: {attempt_text}"},
        ],
        text_format=Corrections,
    )

    output_parsed = getattr(response, "output_parsed", None)
    if not isinstance(output_parsed, Corrections):
        raise RuntimeError("Tutor response was not in expected structured format")

    return output_parsed, model_name


def _correct_attempt_count(session_id: int) -> int:
    db = get_db()
    row = db.execute(
        "SELECT COUNT(*) AS count FROM session_attempts WHERE session_id = ? AND is_correct = 1",
        (session_id,),
    ).fetchone()
    if row is None:
        return 0
    return int(row["count"])


def _session_cursor(session_row) -> int:
    metadata = _parse_session_metadata(session_row["metadata_json"])
    cursor = metadata.get("cursor")
    if isinstance(cursor, int) and cursor >= 0:
        return cursor
    return _correct_attempt_count(int(session_row["id"]))


def _clean_words(value: str) -> list[str]:
    return _clean_text(value).split()


def _diff_payload(*, clip_index: int, expected: str, attempt: str) -> dict:
    expected_words = _clean_words(expected)
    attempt_words = _clean_words(attempt)
    expected_uncap = expected_words.copy()
    attempt_uncap = attempt_words.copy()

    if expected_uncap:
        expected_uncap[0] = expected_uncap[0].lower()
    if attempt_uncap:
        attempt_uncap[0] = attempt_uncap[0].lower()

    word_count_diff = len(attempt_words) - len(expected_words)
    if word_count_diff == 0:
        words = []
        for index, word in enumerate(attempt_words):
            words.append({"word": word, "isMatch": attempt_uncap[index] == expected_uncap[index]})
        return {
            "clipIndex": clip_index,
            "mode": "word_match",
            "expected": expected,
            "attempt": attempt,
            "wordCountDifference": 0,
            "words": words,
            "message": None,
        }

    mismatch = abs(word_count_diff)
    direction = "too_many" if word_count_diff > 0 else "too_few"
    message = f"{mismatch} too many words." if direction == "too_many" else f"{mismatch} too few words."
    return {
        "clipIndex": clip_index,
        "mode": "word_count_mismatch",
        "expected": expected,
        "attempt": attempt,
        "wordCountDifference": word_count_diff,
        "words": [],
        "message": message,
    }


def _insert_session_event(
    db,
    *,
    session_id: int,
    clip_index: int,
    event_type: str,
    points_delta: float,
    payload: dict | None = None,
) -> int:
    payload_json = None
    if payload:
        payload_json = json.dumps(payload, separators=(",", ":"))

    cursor = db.execute(
        """
        INSERT INTO session_events(session_id, clip_index, event_type, points_delta, payload_json)
        VALUES (?, ?, ?, ?, ?)
        """,
        (session_id, clip_index, event_type, points_delta, payload_json),
    )
    event_id = cursor.lastrowid
    if event_id is None:
        raise RuntimeError("Failed to create session event")
    return int(event_id)


def _position_from_cursor(cursor: int, total_clips: int, reps: int) -> tuple[int | None, int | None]:
    total_units = total_clips * reps
    if total_units <= 0 or cursor >= total_units:
        return None, None
    rep_index = (cursor // total_clips) + 1
    clip_index = (cursor % total_clips) + 1
    return clip_index, rep_index


def _session_payload(session_row, *, include_attempts: bool = True) -> dict:
    cursor = _session_cursor(session_row)
    total_clips = int(session_row["total_clips"])
    reps = int(session_row["reps"])
    total_units = total_clips * reps
    clip_index, rep_index = _position_from_cursor(cursor, total_clips, reps)

    attempts = _load_attempts(int(session_row["id"])) if include_attempts else []
    events = _load_session_events(int(session_row["id"])) if include_attempts else []

    current_line = None
    clip_url = None
    if clip_index is not None:
        lines_by_index = _load_text_lines(int(session_row["text_id"]))
        line = lines_by_index.get(clip_index)
        if line is not None:
            current_line = {"index": line["index"], "text": line["text"]}
        clip_url = f"/api/texts/{session_row['text_id']}/clips/{clip_index}"

    return {
        "id": session_row["id"],
        "textId": session_row["text_id"],
        "textName": session_row["text_name"],
        "textLevel": session_row["text_level"],
        "reps": reps,
        "status": session_row["status"],
        "startedAt": session_row["started_at"],
        "endedAt": session_row["ended_at"],
        "durationSeconds": session_row["duration_seconds"],
        "rawScore": session_row["raw_score"],
        "weightedScore": session_row["weighted_score"],
        "totalClips": total_clips,
        "progress": {
            "cursor": cursor,
            "totalUnits": total_units,
            "completedUnits": cursor,
            "remainingUnits": max(total_units - cursor, 0),
            "isFinished": cursor >= total_units,
        },
        "current": {
            "clipIndex": clip_index,
            "repIndex": rep_index,
            "clipUrl": clip_url,
            "line": current_line,
        },
        "attempts": attempts,
        "events": events,
    }


def _session_stats_payload(session_payload: dict) -> dict:
    attempts = session_payload.get("attempts", [])
    events = session_payload.get("events", [])
    command_usage: dict[str, int] = {command: 0 for command in sorted(COMMAND_TYPES)}

    correct_attempts = 0
    for attempt in attempts:
        if attempt.get("isCorrect"):
            correct_attempts += 1

    for event in events:
        event_type = event.get("eventType")
        if isinstance(event_type, str) and event_type in command_usage:
            command_usage[event_type] += 1

    attempts_count = len(attempts)
    accuracy_percent = round((correct_attempts / attempts_count) * 100, 2) if attempts_count > 0 else 0.0

    return {
        "attemptsCount": attempts_count,
        "correctAttempts": correct_attempts,
        "incorrectAttempts": max(attempts_count - correct_attempts, 0),
        "eventsCount": len(events),
        "accuracyPercent": accuracy_percent,
        "commandUsage": command_usage,
    }


def _history_row_payload(row) -> dict:
    return {
        "id": int(row["id"]),
        "textId": int(row["text_id"]),
        "textName": row["text_name"],
        "textLevel": row["text_level"],
        "reps": int(row["reps"]),
        "status": row["status"],
        "startedAt": row["started_at"],
        "endedAt": row["ended_at"],
        "durationSeconds": row["duration_seconds"],
        "rawScore": row["raw_score"],
        "weightedScore": row["weighted_score"],
        "totalClips": int(row["total_clips"]),
    }


def _update_session_progress(
    db,
    *,
    session_id: int,
    cursor: int,
    total_clips: int,
    reps: int,
    raw_score: float,
) -> None:
    clip_index, _ = _position_from_cursor(cursor, total_clips, reps)
    metadata_json = json.dumps({"cursor": cursor}, separators=(",", ":"))
    db.execute(
        """
        UPDATE sessions
        SET current_clip_index = ?, raw_score = ?, metadata_json = ?
        WHERE id = ?
        """,
        (clip_index, raw_score, metadata_json, session_id),
    )


def _finalize_session(session_id: int, *, status: str) -> None:
    db = get_db()
    session_row = _get_owned_session(session_id)
    if session_row is None:
        return

    total_clips = int(session_row["total_clips"])
    raw_score = float(session_row["raw_score"])
    weighted_score = raw_score / total_clips if total_clips > 0 else raw_score

    db.execute(
        """
        UPDATE sessions
        SET
          status = ?,
          ended_at = datetime('now'),
          duration_seconds = CAST((julianday(datetime('now')) - julianday(started_at)) * 86400 AS INTEGER),
          weighted_score = ?,
          current_clip_index = NULL
        WHERE id = ?
        """,
        (status, weighted_score, session_id),
    )
    db.commit()


@require_auth
def list_sessions():
    text_id = _parse_positive_int(request.args.get("text"))
    status = (request.args.get("status") or "").strip().lower()
    date = _parse_iso_date(request.args.get("date"))
    date_from = _parse_iso_date(request.args.get("dateFrom"))
    date_to = _parse_iso_date(request.args.get("dateTo"))

    if request.args.get("text") and text_id is None:
        return error_response("VALIDATION_ERROR", "text must be a positive integer", 400)
    if status and status not in SESSION_STATUSES:
        return error_response("VALIDATION_ERROR", "Unsupported status filter", 400)
    if request.args.get("date") and date is None:
        return error_response("VALIDATION_ERROR", "date must be YYYY-MM-DD", 400)
    if request.args.get("dateFrom") and date_from is None:
        return error_response("VALIDATION_ERROR", "dateFrom must be YYYY-MM-DD", 400)
    if request.args.get("dateTo") and date_to is None:
        return error_response("VALIDATION_ERROR", "dateTo must be YYYY-MM-DD", 400)

    where_parts = ["se.user_id = ?"]
    values = [g.current_user["id"]]

    if text_id is not None:
        where_parts.append("se.text_id = ?")
        values.append(text_id)
    if status:
        where_parts.append("se.status = ?")
        values.append(status)

    if date:
        where_parts.append("date(se.started_at) = ?")
        values.append(date)
    else:
        if date_from:
            where_parts.append("date(se.started_at) >= ?")
            values.append(date_from)
        if date_to:
            where_parts.append("date(se.started_at) <= ?")
            values.append(date_to)

    where_clause = " AND ".join(where_parts)
    db = get_db()
    rows = db.execute(
        f"""
        SELECT
          se.id,
          se.text_id,
          se.reps,
          se.status,
          se.started_at,
          se.ended_at,
          se.duration_seconds,
          se.raw_score,
          se.weighted_score,
          se.total_clips,
          t.name AS text_name,
          t.level AS text_level
        FROM sessions se
        JOIN texts t ON t.id = se.text_id
        WHERE {where_clause}
        ORDER BY datetime(se.started_at) DESC, se.id DESC
        LIMIT 250
        """,
        tuple(values),
    ).fetchall()

    return jsonify({"sessions": [_history_row_payload(row) for row in rows]})


@require_auth
def get_session_details(session_id: int):
    session_row = _get_owned_session(session_id)
    if session_row is None:
        return error_response("NOT_FOUND", "Session not found", 404)

    session = _session_payload(session_row)
    session["stats"] = _session_stats_payload(session)
    return jsonify({"session": session})


@require_auth
def start_session(text_id: int):
    text = _get_owned_text_for_session(text_id)
    if text is None:
        return error_response("NOT_FOUND", "Text not found", 404)
    if not bool(text["is_ready"]):
        return error_response(
            "VALIDATION_ERROR",
            "Text must be validated and ready before starting a session",
            400,
        )

    payload = request.get_json(silent=True) or {}
    reps = _parse_positive_int(payload.get("reps"), default=1)
    if reps is None:
        return error_response("VALIDATION_ERROR", "reps must be a positive integer", 400)

    total_clips = int(text["line_count"])
    if total_clips <= 0:
        return error_response("VALIDATION_ERROR", "Text transcript has no lines to practice", 400)

    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO sessions(
          user_id,
          text_id,
          reps,
          status,
          raw_score,
          total_clips,
          current_clip_index,
          metadata_json
        )
        VALUES (?, ?, ?, 'in_progress', 0, ?, 1, ?)
        """,
        (g.current_user["id"], text_id, reps, total_clips, json.dumps({"cursor": 0}, separators=(",", ":"))),
    )
    db.commit()

    created_session_id = cursor.lastrowid
    if created_session_id is None:
        return error_response("INTERNAL_ERROR", "Failed to create session", 500)
    session_id = int(created_session_id)
    session_row = _get_owned_session(session_id)
    if session_row is None:
        return error_response("INTERNAL_ERROR", "Failed to load session", 500)

    return jsonify({"session": _session_payload(session_row)}), 201


@require_auth
def get_session_state(session_id: int):
    session_row = _get_owned_session(session_id)
    if session_row is None:
        return error_response("NOT_FOUND", "Session not found", 404)
    return jsonify({"session": _session_payload(session_row)})


@require_auth
def create_attempt(session_id: int):
    session_row = _get_owned_session(session_id)
    if session_row is None:
        return error_response("NOT_FOUND", "Session not found", 404)
    if session_row["status"] != "in_progress":
        return error_response("CONFLICT", "Cannot record attempts for a finished session", 409)

    payload = request.get_json(silent=True) or {}
    attempt_text = payload.get("attemptText")
    if not isinstance(attempt_text, str):
        return error_response("VALIDATION_ERROR", "attemptText must be a string", 400)
    if not attempt_text.strip():
        return error_response("VALIDATION_ERROR", "attemptText cannot be blank", 400)

    cursor = _session_cursor(session_row)
    total_clips = int(session_row["total_clips"])
    reps = int(session_row["reps"])
    clip_index, rep_index = _position_from_cursor(cursor, total_clips, reps)
    if clip_index is None or rep_index is None:
        return error_response("CONFLICT", "Session has no remaining clips; complete it", 409)

    lines_by_index = _load_text_lines(int(session_row["text_id"]))
    expected_line = lines_by_index.get(clip_index)
    if expected_line is None:
        return error_response("INTERNAL_ERROR", "Missing text line for clip index", 500)

    is_correct = _check_attempt(expected_line["text"], attempt_text)
    db = get_db()
    attempt_cursor = db.execute(
        """
        INSERT INTO session_attempts(
          session_id,
          text_line_id,
          clip_index,
          rep_index,
          attempt_text,
          is_correct
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (session_id, expected_line["id"], clip_index, rep_index, attempt_text, int(is_correct)),
    )

    next_cursor = cursor + 1 if is_correct else cursor
    raw_score = float(session_row["raw_score"])
    if not is_correct:
        raw_score += _get_scoring_rule(db, "wrong_attempt", fallback=1.0)

    _update_session_progress(
        db,
        session_id=session_id,
        cursor=next_cursor,
        total_clips=total_clips,
        reps=reps,
        raw_score=raw_score,
    )
    db.commit()

    refreshed_session = _get_owned_session(session_id)
    if refreshed_session is None:
        return error_response("INTERNAL_ERROR", "Failed to load session", 500)

    return jsonify(
        {
            "attempt": {
                "id": attempt_cursor.lastrowid,
                "clipIndex": clip_index,
                "repIndex": rep_index,
                "attemptText": attempt_text,
                "isCorrect": is_correct,
            },
            "session": _session_payload(refreshed_session),
        }
    )


@require_auth
def create_session_event(session_id: int):
    session_row = _get_owned_session(session_id)
    if session_row is None:
        return error_response("NOT_FOUND", "Session not found", 404)

    payload = request.get_json(silent=True) or {}
    event_type = payload.get("eventType")
    if not isinstance(event_type, str):
        return error_response("VALIDATION_ERROR", "eventType is required", 400)
    event_type = event_type.strip().lower()
    if event_type not in COMMAND_TYPES:
        return error_response("VALIDATION_ERROR", "Unsupported eventType", 400)

    if session_row["status"] != "in_progress" and event_type != "help":
        return error_response("CONFLICT", "Cannot add events to a finished session", 409)

    cursor = _session_cursor(session_row)
    total_clips = int(session_row["total_clips"])
    reps = int(session_row["reps"])
    clip_index, rep_index = _position_from_cursor(cursor, total_clips, reps)
    if clip_index is None:
        clip_index = total_clips if total_clips > 0 else 1

    points_delta = 0.0
    details: dict = {}
    next_cursor = cursor

    latest_attempt = None
    if rep_index is not None:
        latest_attempt = _latest_attempt_for_position(session_id, clip_index=clip_index, rep_index=rep_index)

    if event_type == "replay":
        points_delta = _get_scoring_rule(get_db(), "replay", fallback=1.0)
    elif event_type == "diff":
        if latest_attempt is None:
            return error_response("VALIDATION_ERROR", "No previous attempt to show diff for", 400)
        points_delta = _get_scoring_rule(get_db(), "diff", fallback=1.0)
        details["attemptId"] = int(latest_attempt["id"])
    elif event_type == "tutor":
        if latest_attempt is None:
            return error_response("VALIDATION_ERROR", "No previous attempt to tutor for", 400)
        points_delta = _get_scoring_rule(get_db(), "tutor", fallback=5.0)
        details["attemptId"] = int(latest_attempt["id"])
    elif event_type == "answer":
        if rep_index is None:
            return error_response("CONFLICT", "Session has no active line", 409)
        lines_by_index = _load_text_lines(int(session_row["text_id"]))
        expected_line = lines_by_index.get(clip_index)
        if expected_line is None:
            return error_response("INTERNAL_ERROR", "Missing text line for clip index", 500)
        points_delta = _get_scoring_rule(get_db(), "answer", fallback=5.0)
        details["line"] = {"index": clip_index, "text": expected_line["text"]}
    elif event_type == "keep":
        if rep_index is None:
            return error_response("CONFLICT", "Session has no active line", 409)
        if latest_attempt is None:
            return error_response("VALIDATION_ERROR", "No previous attempt to keep", 400)
        keep_penalty = _get_scoring_rule(get_db(), "keep", fallback=0.0)
        points_delta += keep_penalty
        if not bool(latest_attempt["is_correct"]):
            points_delta += _get_scoring_rule(get_db(), "wrong_attempt", fallback=1.0)
        next_cursor = min(cursor + 1, total_clips * reps)
        details["attemptId"] = int(latest_attempt["id"])
        details["keptWasCorrect"] = bool(latest_attempt["is_correct"])
    elif event_type == "help":
        details["commands"] = HELP_COMMANDS
    elif event_type == "exit":
        points_delta = _get_scoring_rule(get_db(), "exit", fallback=0.0)

    db = get_db()
    raw_score = float(session_row["raw_score"]) + points_delta
    if next_cursor != cursor or points_delta != 0:
        _update_session_progress(
            db,
            session_id=session_id,
            cursor=next_cursor,
            total_clips=total_clips,
            reps=reps,
            raw_score=raw_score,
        )

    event_id = _insert_session_event(
        db,
        session_id=session_id,
        clip_index=clip_index,
        event_type=event_type,
        points_delta=points_delta,
        payload=details or None,
    )

    logger.info(
        "session_event session_id=%s event_type=%s clip_index=%s points_delta=%.2f",
        session_id,
        event_type,
        clip_index,
        points_delta,
    )
    db.commit()

    if event_type == "exit" and session_row["status"] == "in_progress":
        refreshed_for_exit = _get_owned_session(session_id)
        if refreshed_for_exit is None:
            return error_response("INTERNAL_ERROR", "Failed to load session", 500)
        cursor_after_event = _session_cursor(refreshed_for_exit)
        total_units = int(refreshed_for_exit["total_clips"]) * int(refreshed_for_exit["reps"])
        status = "completed" if cursor_after_event >= total_units else "incomplete"
        _finalize_session(session_id, status=status)

    refreshed_session = _get_owned_session(session_id)
    if refreshed_session is None:
        return error_response("INTERNAL_ERROR", "Failed to load session", 500)

    return jsonify(
        {
            "event": {
                "id": event_id,
                "eventType": event_type,
                "clipIndex": clip_index,
                "pointsDelta": points_delta,
                "payload": details or None,
            },
            "session": _session_payload(refreshed_session),
        }
    )


@require_auth
def create_session_diff(session_id: int):
    session_row = _get_owned_session(session_id)
    if session_row is None:
        return error_response("NOT_FOUND", "Session not found", 404)

    payload = request.get_json(silent=True) or {}

    cursor = _session_cursor(session_row)
    total_clips = int(session_row["total_clips"])
    reps = int(session_row["reps"])
    active_clip_index, active_rep_index = _position_from_cursor(cursor, total_clips, reps)
    if active_clip_index is None or active_rep_index is None:
        return error_response("CONFLICT", "Session has no active line", 409)

    clip_index = _parse_positive_int(payload.get("clipIndex"), default=active_clip_index)
    if clip_index is None:
        return error_response("VALIDATION_ERROR", "clipIndex must be a positive integer", 400)

    rep_index = _parse_positive_int(payload.get("repIndex"), default=active_rep_index)
    if rep_index is None:
        return error_response("VALIDATION_ERROR", "repIndex must be a positive integer", 400)

    attempt_text = payload.get("attemptText")
    if attempt_text is not None and not isinstance(attempt_text, str):
        return error_response("VALIDATION_ERROR", "attemptText must be a string", 400)

    latest_attempt = None
    if attempt_text is None:
        latest_attempt = _latest_attempt_for_position(session_id, clip_index=clip_index, rep_index=rep_index)
        if latest_attempt is None:
            return error_response("VALIDATION_ERROR", "No previous attempt to show diff for", 400)
        attempt_text = latest_attempt["attempt_text"]

    lines_by_index = _load_text_lines(int(session_row["text_id"]))
    expected_line = lines_by_index.get(clip_index)
    if expected_line is None:
        return error_response("NOT_FOUND", "Line not found for clipIndex", 404)

    diff = _diff_payload(clip_index=clip_index, expected=expected_line["text"], attempt=attempt_text)
    if latest_attempt is not None:
        diff["attemptId"] = int(latest_attempt["id"])

    return jsonify({"diff": diff})


@require_auth
def create_tutor_feedback(session_id: int):
    session_row = _get_owned_session(session_id)
    if session_row is None:
        return error_response("NOT_FOUND", "Session not found", 404)
    if session_row["status"] != "in_progress":
        return error_response("CONFLICT", "Session is not in progress", 409)

    payload = request.get_json(silent=True) or {}
    cursor = _session_cursor(session_row)
    total_clips = int(session_row["total_clips"])
    reps = int(session_row["reps"])
    active_clip_index, active_rep_index = _position_from_cursor(cursor, total_clips, reps)
    if active_clip_index is None or active_rep_index is None:
        return error_response("CONFLICT", "Session has no active line", 409)

    clip_index = _parse_positive_int(payload.get("clipIndex"), default=active_clip_index)
    if clip_index is None:
        return error_response("VALIDATION_ERROR", "clipIndex must be a positive integer", 400)
    rep_index = _parse_positive_int(payload.get("repIndex"), default=active_rep_index)
    if rep_index is None:
        return error_response("VALIDATION_ERROR", "repIndex must be a positive integer", 400)

    attempt_text = payload.get("attemptText")
    latest_attempt = _latest_attempt_for_position(session_id, clip_index=clip_index, rep_index=rep_index)

    if attempt_text is not None and not isinstance(attempt_text, str):
        return error_response("VALIDATION_ERROR", "attemptText must be a string", 400)
    if attempt_text is None:
        if latest_attempt is None:
            return error_response("VALIDATION_ERROR", "No previous attempt to tutor for", 400)
        attempt_text = latest_attempt["attempt_text"]

    attempt_text = attempt_text.strip()
    if not attempt_text:
        return error_response("VALIDATION_ERROR", "attemptText cannot be blank", 400)
    if latest_attempt is not None and bool(latest_attempt["is_correct"]):
        return error_response("VALIDATION_ERROR", "Tutor feedback is only available for incorrect attempts", 400)

    lines_by_index = _load_text_lines(int(session_row["text_id"]))
    expected_line = lines_by_index.get(clip_index)
    if expected_line is None:
        return error_response("NOT_FOUND", "Line not found for clipIndex", 404)

    text_body = _text_body_from_lines(int(session_row["text_id"]))
    if not text_body:
        return error_response("INTERNAL_ERROR", "Could not build text body for tutor", 500)

    try:
        corrections, model_name = _openai_tutor_response(
            text_body=text_body,
            line_text=expected_line["text"],
            attempt_text=attempt_text,
        )
    except Exception as error:  # pragma: no cover
        logger.exception("tutor_feedback_failed session_id=%s clip_index=%s", session_id, clip_index)
        return error_response("TUTOR_UNAVAILABLE", f"Tutor feedback is temporarily unavailable: {error}", 503)

    # Serialize Corrections to JSON for storage
    response_data = corrections.model_dump_json()

    db = get_db()
    insert_cursor = db.execute(
        """
        INSERT INTO tutor_feedback(
          session_id,
          clip_index,
          attempt_text,
          line_text,
          model_name,
          response_data
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (session_id, clip_index, attempt_text, expected_line["text"], model_name, response_data),
    )
    db.commit()

    feedback_id = insert_cursor.lastrowid
    if feedback_id is None:
        return error_response("INTERNAL_ERROR", "Failed to save tutor feedback", 500)

    return jsonify(
        {
            "feedback": {
                "id": int(feedback_id),
                "clipIndex": clip_index,
                "attemptText": attempt_text,
                "lineText": expected_line["text"],
                "modelName": model_name,
                "corrections": corrections.model_dump()["corrections"],
            },
            "history": _load_tutor_feedback_history(session_id),
        }
    )


@require_auth
def complete_session(session_id: int):
    session_row = _get_owned_session(session_id)
    if session_row is None:
        return error_response("NOT_FOUND", "Session not found", 404)

    if session_row["status"] == "completed":
        return jsonify({"session": _session_payload(session_row)})
    if session_row["status"] != "in_progress":
        return error_response("CONFLICT", "Session is already finalized", 409)

    cursor = _session_cursor(session_row)
    total_units = int(session_row["total_clips"]) * int(session_row["reps"])
    if cursor < total_units:
        return error_response(
            "VALIDATION_ERROR",
            "Session cannot be completed before all clips are correct",
            400,
        )

    _finalize_session(session_id, status="completed")
    updated = _get_owned_session(session_id)
    if updated is None:
        return error_response("INTERNAL_ERROR", "Failed to load session", 500)
    return jsonify({"session": _session_payload(updated)})


@require_auth
def exit_session(session_id: int):
    session_row = _get_owned_session(session_id)
    if session_row is None:
        return error_response("NOT_FOUND", "Session not found", 404)

    if session_row["status"] in {"completed", "incomplete", "abandoned"}:
        return jsonify({"session": _session_payload(session_row)})

    cursor = _session_cursor(session_row)
    total_units = int(session_row["total_clips"]) * int(session_row["reps"])
    status = "completed" if cursor >= total_units else "incomplete"
    _finalize_session(session_id, status=status)

    updated = _get_owned_session(session_id)
    if updated is None:
        return error_response("INTERNAL_ERROR", "Failed to load session", 500)
    return jsonify({"session": _session_payload(updated)})
