import sqlite3
from pathlib import Path
import re

from flask import current_app, g, jsonify, request, send_file

from ..auth import error_response, require_auth
from ..db import get_db

CLIP_NAME_PATTERN = re.compile(r"^c-(\d+)\.mp3$", re.IGNORECASE)


def _normalize_text(value) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def _normalize_optional_text(value) -> str | None:
    normalized = _normalize_text(value)
    if not normalized:
        return None
    return normalized


def _transcript_from_payload(payload: dict) -> str | None:
    if "transcriptRaw" in payload:
        transcript_raw = payload.get("transcriptRaw")
        return transcript_raw if isinstance(transcript_raw, str) else None
    transcript = payload.get("transcript")
    return transcript if isinstance(transcript, str) else None


def _parse_transcript_lines(transcript_raw: str) -> list[str]:
    normalized = transcript_raw.replace("\r\n", "\n").replace("\r", "\n")
    return [line.strip() for line in normalized.split("\n") if line.strip()]


def _parse_clip_index(filename: str) -> int | None:
    match = CLIP_NAME_PATTERN.match(filename)
    if match is None:
        return None
    try:
        index = int(match.group(1))
    except ValueError:
        return None
    if index < 1:
        return None
    return index


def _has_mp3_signature(file_storage) -> bool:
    stream = file_storage.stream
    position = stream.tell()
    header = stream.read(10)
    stream.seek(position)

    if len(header) < 2:
        return False
    if header.startswith(b"ID3"):
        return True
    return header[0] == 0xFF and (header[1] & 0xE0) == 0xE0


def _chapter_clip_dir(chapter_id: int) -> Path:
    return Path(current_app.config["CLIP_STORAGE_ROOT"]) / str(g.current_user["id"]) / str(
        chapter_id
    )


def _clip_storage_relative_path(chapter_id: int, clip_index: int) -> str:
    return f"{g.current_user['id']}/{chapter_id}/c-{clip_index}.mp3"


def _clip_storage_absolute_path(chapter_id: int, clip_index: int) -> Path:
    return _chapter_clip_dir(chapter_id) / f"c-{clip_index}.mp3"


def _load_clip_indexes(chapter_id: int) -> list[int]:
    db = get_db()
    rows = db.execute(
        """
        SELECT clip_index
        FROM chapter_clips
        WHERE chapter_id = ?
        ORDER BY clip_index ASC
        """,
        (chapter_id,),
    ).fetchall()
    return [int(row["clip_index"]) for row in rows]


def _get_chapter_clip(chapter_id: int, clip_index: int):
    db = get_db()
    return db.execute(
        """
        SELECT clip_index, storage_path, mime_type
        FROM chapter_clips
        WHERE chapter_id = ? AND clip_index = ?
        """,
        (chapter_id, clip_index),
    ).fetchone()


def _validation_result(chapter_id: int, *, line_count: int) -> dict:
    clip_indexes = _load_clip_indexes(chapter_id)
    clip_count = len(clip_indexes)
    clip_set = set(clip_indexes)
    missing_indexes = [index for index in range(1, line_count + 1) if index not in clip_set]
    is_ready = line_count > 0 and clip_count == line_count and len(missing_indexes) == 0

    return {
        "lineCount": line_count,
        "clipCount": clip_count,
        "missingIndexes": missing_indexes,
        "isReady": is_ready,
    }


def _chapter_payload(chapter_row, lines: list[dict] | None = None) -> dict:
    payload = {
        "id": chapter_row["id"],
        "storyId": chapter_row["story_id"],
        "chapterCode": chapter_row["chapter_code"],
        "title": chapter_row["title"],
        "transcriptRaw": chapter_row["transcript_raw"],
        "clipCount": chapter_row["clip_count"],
        "lineCount": chapter_row["line_count"],
        "isReady": bool(chapter_row["is_ready"]),
        "createdAt": chapter_row["created_at"],
        "updatedAt": chapter_row["updated_at"],
    }
    if lines is not None:
        payload["lines"] = lines
    return payload


def _get_owned_story(story_id: int):
    db = get_db()
    return db.execute(
        "SELECT id FROM stories WHERE id = ? AND user_id = ?",
        (story_id, g.current_user["id"]),
    ).fetchone()


def _get_owned_chapter(chapter_id: int):
    db = get_db()
    return db.execute(
        """
        SELECT
          c.id,
          c.story_id,
          c.chapter_code,
          c.title,
          c.transcript_raw,
          c.clip_count,
          c.line_count,
          c.is_ready,
          c.created_at,
          c.updated_at
        FROM chapters c
        JOIN stories s ON s.id = c.story_id
        WHERE c.id = ? AND s.user_id = ?
        """,
        (chapter_id, g.current_user["id"]),
    ).fetchone()


def _load_chapter_lines(chapter_id: int) -> list[dict]:
    db = get_db()
    rows = db.execute(
        """
        SELECT line_index, line_text
        FROM chapter_lines
        WHERE chapter_id = ?
        ORDER BY line_index ASC
        """,
        (chapter_id,),
    ).fetchall()
    return [{"index": row["line_index"], "text": row["line_text"]} for row in rows]


def _replace_chapter_lines(
    db,
    *,
    chapter_id: int,
    transcript_raw: str,
    parsed_lines: list[str],
) -> None:
    db.execute("DELETE FROM chapter_lines WHERE chapter_id = ?", (chapter_id,))
    for index, text in enumerate(parsed_lines, start=1):
        db.execute(
            """
            INSERT INTO chapter_lines(chapter_id, line_index, line_text)
            VALUES (?, ?, ?)
            """,
            (chapter_id, index, text),
        )

    db.execute(
        """
        UPDATE chapters
        SET transcript_raw = ?, line_count = ?, is_ready = 0, updated_at = datetime('now')
        WHERE id = ?
        """,
        (transcript_raw, len(parsed_lines), chapter_id),
    )


@require_auth
def list_chapters(story_id: int):
    if _get_owned_story(story_id) is None:
        return error_response("NOT_FOUND", "Story not found", 404)

    db = get_db()
    rows = db.execute(
        """
        SELECT
          id,
          story_id,
          chapter_code,
          title,
          transcript_raw,
          clip_count,
          line_count,
          is_ready,
          created_at,
          updated_at
        FROM chapters
        WHERE story_id = ? AND user_id = ?
        ORDER BY datetime(created_at) ASC, id ASC
        """,
        (story_id, g.current_user["id"]),
    ).fetchall()

    return jsonify({"chapters": [_chapter_payload(row) for row in rows]})


@require_auth
def create_chapter(story_id: int):
    if _get_owned_story(story_id) is None:
        return error_response("NOT_FOUND", "Story not found", 404)

    payload = request.get_json(silent=True) or {}
    title = _normalize_text(payload.get("title"))
    chapter_code = _normalize_optional_text(payload.get("chapterCode"))
    transcript_raw = _transcript_from_payload(payload)

    if not isinstance(transcript_raw, str):
        transcript_raw = ""
    transcript_raw = transcript_raw.strip()

    if not title:
        return error_response("VALIDATION_ERROR", "title is required", 400)
    if not transcript_raw:
        return error_response("VALIDATION_ERROR", "transcriptRaw is required", 400)

    parsed_lines = _parse_transcript_lines(transcript_raw)
    db = get_db()
    try:
        cursor = db.execute(
            """
            INSERT INTO chapters(user_id, story_id, chapter_code, title, transcript_raw, line_count)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                g.current_user["id"],
                story_id,
                chapter_code,
                title,
                transcript_raw,
                len(parsed_lines),
            ),
        )
        chapter_id = cursor.lastrowid
        if chapter_id is None:
            db.rollback()
            return error_response("INTERNAL_ERROR", "Failed to create chapter", 500)

        for index, text in enumerate(parsed_lines, start=1):
            db.execute(
                """
                INSERT INTO chapter_lines(chapter_id, line_index, line_text)
                VALUES (?, ?, ?)
                """,
                (chapter_id, index, text),
            )
        db.commit()
    except sqlite3.IntegrityError:
        return error_response(
            "CONFLICT",
            "A chapter with that code already exists for this story",
            409,
        )

    chapter = _get_owned_chapter(int(chapter_id))
    if chapter is None:
        return error_response("INTERNAL_ERROR", "Failed to load chapter", 500)
    lines = _load_chapter_lines(int(chapter_id))
    return jsonify({"chapter": _chapter_payload(chapter, lines=lines)}), 201


@require_auth
def get_chapter(chapter_id: int):
    chapter = _get_owned_chapter(chapter_id)
    if chapter is None:
        return error_response("NOT_FOUND", "Chapter not found", 404)

    lines = _load_chapter_lines(chapter_id)
    return jsonify({"chapter": _chapter_payload(chapter, lines=lines)})


@require_auth
def update_chapter(chapter_id: int):
    payload = request.get_json(silent=True) or {}
    has_title = "title" in payload
    has_code = "chapterCode" in payload
    if not has_title and not has_code:
        return error_response("VALIDATION_ERROR", "No updatable fields provided", 400)

    current = _get_owned_chapter(chapter_id)
    if current is None:
        return error_response("NOT_FOUND", "Chapter not found", 404)

    title = _normalize_text(payload.get("title")) if has_title else current["title"]
    chapter_code = (
        _normalize_optional_text(payload.get("chapterCode"))
        if has_code
        else current["chapter_code"]
    )

    if not title:
        return error_response("VALIDATION_ERROR", "title cannot be empty", 400)

    db = get_db()
    try:
        db.execute(
            """
            UPDATE chapters
            SET title = ?, chapter_code = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (title, chapter_code, chapter_id),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return error_response(
            "CONFLICT",
            "A chapter with that code already exists for this story",
            409,
        )

    chapter = _get_owned_chapter(chapter_id)
    if chapter is None:
        return error_response("NOT_FOUND", "Chapter not found", 404)
    lines = _load_chapter_lines(chapter_id)
    return jsonify({"chapter": _chapter_payload(chapter, lines=lines)})


@require_auth
def delete_chapter(chapter_id: int):
    chapter = _get_owned_chapter(chapter_id)
    if chapter is None:
        return error_response("NOT_FOUND", "Chapter not found", 404)

    db = get_db()
    db.execute("DELETE FROM chapters WHERE id = ?", (chapter_id,))
    db.commit()
    return "", 204


@require_auth
def update_chapter_transcript(chapter_id: int):
    chapter = _get_owned_chapter(chapter_id)
    if chapter is None:
        return error_response("NOT_FOUND", "Chapter not found", 404)

    payload = request.get_json(silent=True) or {}
    transcript_raw = _transcript_from_payload(payload)
    if not isinstance(transcript_raw, str):
        transcript_raw = ""
    transcript_raw = transcript_raw.strip()

    if not transcript_raw:
        return error_response("VALIDATION_ERROR", "transcriptRaw is required", 400)

    parsed_lines = _parse_transcript_lines(transcript_raw)
    db = get_db()
    _replace_chapter_lines(
        db,
        chapter_id=chapter_id,
        transcript_raw=transcript_raw,
        parsed_lines=parsed_lines,
    )
    db.commit()

    updated = _get_owned_chapter(chapter_id)
    if updated is None:
        return error_response("NOT_FOUND", "Chapter not found", 404)
    lines = _load_chapter_lines(chapter_id)
    return jsonify({"chapter": _chapter_payload(updated, lines=lines)})


@require_auth
def upload_chapter_clips(chapter_id: int):
    chapter = _get_owned_chapter(chapter_id)
    if chapter is None:
        return error_response("NOT_FOUND", "Chapter not found", 404)

    files = request.files.getlist("clips")
    if not files:
        for field_name in request.files:
            files.extend(request.files.getlist(field_name))
    if not files:
        return error_response(
            "VALIDATION_ERROR",
            "At least one MP3 clip file is required",
            400,
        )

    parsed_files = []
    seen_indexes = set()
    for file_storage in files:
        original_name = Path(file_storage.filename or "").name
        clip_index = _parse_clip_index(original_name)
        if clip_index is None:
            return error_response(
                "VALIDATION_ERROR",
                "Each file must be named c-<index>.mp3",
                400,
            )
        if clip_index in seen_indexes:
            return error_response(
                "VALIDATION_ERROR",
                f"Duplicate clip index in upload payload: {clip_index}",
                400,
            )
        if not _has_mp3_signature(file_storage):
            return error_response(
                "VALIDATION_ERROR",
                f"Invalid MP3 file: {original_name}",
                400,
            )

        seen_indexes.add(clip_index)
        parsed_files.append((clip_index, original_name, file_storage))

    parsed_files.sort(key=lambda item: item[0])
    target_dir = _chapter_clip_dir(chapter_id)
    target_dir.mkdir(parents=True, exist_ok=True)

    db = get_db()
    for clip_index, original_name, file_storage in parsed_files:
        relative_path = _clip_storage_relative_path(chapter_id, clip_index)
        absolute_path = _clip_storage_absolute_path(chapter_id, clip_index)
        file_storage.save(str(absolute_path))
        db.execute(
            """
            INSERT INTO chapter_clips(
              chapter_id,
              clip_index,
              original_filename,
              storage_path,
              mime_type,
              trimmed
            )
            VALUES (?, ?, ?, ?, ?, 0)
            ON CONFLICT(chapter_id, clip_index)
            DO UPDATE SET
              original_filename = excluded.original_filename,
              storage_path = excluded.storage_path,
              mime_type = excluded.mime_type,
              created_at = datetime('now')
            """,
            (
                chapter_id,
                clip_index,
                original_name,
                relative_path,
                "audio/mpeg",
            ),
        )

    clip_count_row = db.execute(
        "SELECT COUNT(*) AS clip_count FROM chapter_clips WHERE chapter_id = ?",
        (chapter_id,),
    ).fetchone()
    clip_count = int(clip_count_row["clip_count"]) if clip_count_row else 0
    db.execute(
        """
        UPDATE chapters
        SET clip_count = ?, is_ready = 0, updated_at = datetime('now')
        WHERE id = ?
        """,
        (clip_count, chapter_id),
    )
    db.commit()

    return jsonify(
        {
            "chapterId": chapter_id,
            "uploadedCount": len(parsed_files),
            "clipCount": clip_count,
            "uploadedIndexes": [item[0] for item in parsed_files],
        }
    )


@require_auth
def get_chapter_clip(chapter_id: int, clip_index: int):
    chapter = _get_owned_chapter(chapter_id)
    if chapter is None:
        return error_response("NOT_FOUND", "Chapter not found", 404)

    clip = _get_chapter_clip(chapter_id, clip_index)
    if clip is None:
        return error_response("NOT_FOUND", "Clip not found", 404)

    relative_path = clip["storage_path"]
    absolute_path = Path(current_app.config["CLIP_STORAGE_ROOT"]) / relative_path
    if not absolute_path.exists() or not absolute_path.is_file():
        return error_response("NOT_FOUND", "Clip file not found", 404)

    mime_type = clip["mime_type"] or "audio/mpeg"
    return send_file(absolute_path, mimetype=mime_type, conditional=True)


@require_auth
def validate_chapter_readiness(chapter_id: int):
    chapter = _get_owned_chapter(chapter_id)
    if chapter is None:
        return error_response("NOT_FOUND", "Chapter not found", 404)

    db = get_db()
    readiness = _validation_result(chapter_id, line_count=int(chapter["line_count"]))
    db.execute(
        """
        UPDATE chapters
        SET clip_count = ?, is_ready = ?, updated_at = datetime('now')
        WHERE id = ?
        """,
        (readiness["clipCount"], int(readiness["isReady"]), chapter_id),
    )
    db.commit()

    return jsonify({"readiness": readiness})
