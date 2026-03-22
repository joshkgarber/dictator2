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
    if not isinstance(value, str):
        return ""
    return value.strip()


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
    header = stream.read(10)

    if len(header) < 2:
        return False
    if header.startswith(b"ID3"):
        return True
    return header[0] == 0xFF and (header[1] & 0xE0) == 0xE0


def _text_clip_dir(text_id: int) -> Path:
    return Path(current_app.config["CLIP_STORAGE_ROOT"]) / str(g.current_user["id"]) / str(text_id)


def _clip_storage_relative_path(text_id: int, clip_index: int) -> str:
    return f"{g.current_user['id']}/{text_id}/c-{clip_index}.mp3"


def _clip_storage_absolute_path(text_id: int, clip_index: int) -> Path:
    return _text_clip_dir(text_id) / f"c-{clip_index}.mp3"


def _load_clip_indexes(text_id: int) -> list[int]:
    db = get_db()
    rows = db.execute(
        """
        SELECT clip_index
        FROM text_clips
        WHERE text_id = ?
        ORDER BY clip_index ASC
        """,
        (text_id,),
    ).fetchall()
    return [int(row["clip_index"]) for row in rows]


def _get_text_clip(text_id: int, clip_index: int):
    db = get_db()
    return db.execute(
        """
        SELECT clip_index, storage_path, mime_type
        FROM text_clips
        WHERE text_id = ? AND clip_index = ?
        """,
        (text_id, clip_index),
    ).fetchone()


def _validation_result(text_id: int, *, line_count: int) -> dict:
    clip_indexes = _load_clip_indexes(text_id)
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


def _get_schedule_for_text(text_id: int):
    db = get_db()
    return db.execute(
        """
        SELECT id, next_session_date, notes, created_at, updated_at
        FROM text_schedules
        WHERE user_id = ? AND text_id = ?
        """,
        (g.current_user["id"], text_id),
    ).fetchone()


def _get_recent_sessions_for_text(text_id: int, *, limit: int = 5) -> list[dict]:
    db = get_db()
    rows = db.execute(
        """
        SELECT id, status, started_at, ended_at, weighted_score
        FROM sessions
        WHERE user_id = ? AND text_id = ?
        ORDER BY datetime(started_at) DESC, id DESC
        LIMIT ?
        """,
        (g.current_user["id"], text_id, limit),
    ).fetchall()
    return [
        {
            "id": int(row["id"]),
            "status": row["status"],
            "startedAt": row["started_at"],
            "endedAt": row["ended_at"],
            "weightedScore": row["weighted_score"],
        }
        for row in rows
    ]


def _text_payload(text_row, lines: list[dict] | None = None, *, include_relations: bool = False) -> dict:
    payload = {
        "id": text_row["id"],
        "name": text_row["name"],
        "level": text_row["level"],
        "transcriptRaw": text_row["transcript_raw"],
        "clipCount": text_row["clip_count"],
        "lineCount": text_row["line_count"],
        "isReady": bool(text_row["is_ready"]),
        "reps": int(text_row["reps"]),
        "createdAt": text_row["created_at"],
        "updatedAt": text_row["updated_at"],
    }
    if lines is not None:
        payload["lines"] = lines

    if include_relations:
        schedule = _get_schedule_for_text(int(text_row["id"]))
        payload["schedule"] = (
            {
                "id": int(schedule["id"]),
                "nextSessionDate": schedule["next_session_date"],
                "notes": schedule["notes"],
                "createdAt": schedule["created_at"],
                "updatedAt": schedule["updated_at"],
            }
            if schedule
            else None
        )
        payload["recentSessions"] = _get_recent_sessions_for_text(int(text_row["id"]))

    return payload


def _get_owned_text(text_id: int):
    db = get_db()
    return db.execute(
        """
        SELECT
          id,
          user_id,
          name,
          level,
          transcript_raw,
          clip_count,
          line_count,
          is_ready,
          reps,
          created_at,
          updated_at
        FROM texts
        WHERE id = ? AND user_id = ?
        """,
        (text_id, g.current_user["id"]),
    ).fetchone()


def _load_text_lines(text_id: int) -> list[dict]:
    db = get_db()
    rows = db.execute(
        """
        SELECT line_index, line_text
        FROM text_lines
        WHERE text_id = ?
        ORDER BY line_index ASC
        """,
        (text_id,),
    ).fetchall()
    return [{"index": row["line_index"], "text": row["line_text"]} for row in rows]


def _replace_text_lines(
    db,
    *,
    text_id: int,
    transcript_raw: str,
    parsed_lines: list[str],
) -> None:
    db.execute("DELETE FROM text_lines WHERE text_id = ?", (text_id,))
    for index, text in enumerate(parsed_lines, start=1):
        db.execute(
            """
            INSERT INTO text_lines(text_id, line_index, line_text)
            VALUES (?, ?, ?)
            """,
            (text_id, index, text),
        )

    db.execute(
        """
        UPDATE texts
        SET transcript_raw = ?, line_count = ?, is_ready = 0, updated_at = datetime('now')
        WHERE id = ?
        """,
        (transcript_raw, len(parsed_lines), text_id),
    )


@require_auth
def list_texts():
    db = get_db()
    level_filter = _normalize_text(request.args.get("level"))

    if level_filter:
        rows = db.execute(
            """
            SELECT
              id,
              user_id,
              name,
              level,
              transcript_raw,
              clip_count,
              line_count,
              is_ready,
              reps,
              created_at,
              updated_at
            FROM texts
            WHERE user_id = ? AND level = ?
            ORDER BY datetime(created_at) ASC, id ASC
            """,
            (g.current_user["id"], level_filter),
        ).fetchall()
    else:
        rows = db.execute(
            """
            SELECT
              id,
              user_id,
              name,
              level,
              transcript_raw,
              clip_count,
              line_count,
              is_ready,
              reps,
              created_at,
              updated_at
            FROM texts
            WHERE user_id = ?
            ORDER BY datetime(created_at) ASC, id ASC
            """,
            (g.current_user["id"],),
        ).fetchall()

    return jsonify({"texts": [_text_payload(row, include_relations=True) for row in rows]})


@require_auth
def create_text():
    payload = request.get_json(silent=True) or {}
    name = _normalize_text(payload.get("name"))
    level = _normalize_text(payload.get("level"))
    transcript_raw = _transcript_from_payload(payload)
    reps = _parse_positive_int(payload.get("reps"), default=1)

    if not isinstance(transcript_raw, str):
        transcript_raw = ""
    transcript_raw = transcript_raw.strip()

    if not name:
        return error_response("VALIDATION_ERROR", "name is required", 400)
    if not level:
        return error_response("VALIDATION_ERROR", "level is required", 400)
    if not transcript_raw:
        return error_response("VALIDATION_ERROR", "transcriptRaw is required", 400)
    if reps is None:
        return error_response("VALIDATION_ERROR", "reps must be a positive integer", 400)

    parsed_lines = _parse_transcript_lines(transcript_raw)
    db = get_db()
    try:
        cursor = db.execute(
            """
            INSERT INTO texts(user_id, name, level, transcript_raw, line_count, reps)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (g.current_user["id"], name, level, transcript_raw, len(parsed_lines), reps),
        )
        text_id = cursor.lastrowid
        if text_id is None:
            db.rollback()
            return error_response("INTERNAL_ERROR", "Failed to create text", 500)

        for index, text in enumerate(parsed_lines, start=1):
            db.execute(
                """
                INSERT INTO text_lines(text_id, line_index, line_text)
                VALUES (?, ?, ?)
                """,
                (text_id, index, text),
            )
        db.commit()
    except sqlite3.IntegrityError:
        return error_response(
            "CONFLICT",
            "A text with that name already exists",
            409,
        )

    text = _get_owned_text(int(text_id))
    if text is None:
        return error_response("INTERNAL_ERROR", "Failed to load text", 500)
    lines = _load_text_lines(int(text_id))
    return jsonify({"text": _text_payload(text, lines=lines, include_relations=True)}), 201


@require_auth
def get_text(text_id: int):
    text = _get_owned_text(text_id)
    if text is None:
        return error_response("NOT_FOUND", "Text not found", 404)

    lines = _load_text_lines(text_id)
    return jsonify({"text": _text_payload(text, lines=lines, include_relations=True)})


@require_auth
def update_text(text_id: int):
    payload = request.get_json(silent=True) or {}
    has_name = "name" in payload
    has_level = "level" in payload
    has_reps = "reps" in payload
    if not has_name and not has_level and not has_reps:
        return error_response("VALIDATION_ERROR", "No updatable fields provided", 400)

    current = _get_owned_text(text_id)
    if current is None:
        return error_response("NOT_FOUND", "Text not found", 404)

    name = _normalize_text(payload.get("name")) if has_name else current["name"]
    level = _normalize_text(payload.get("level")) if has_level else current["level"]
    reps = _parse_positive_int(payload.get("reps")) if has_reps else int(current["reps"])

    if not name:
        return error_response("VALIDATION_ERROR", "name cannot be empty", 400)
    if not level:
        return error_response("VALIDATION_ERROR", "level cannot be empty", 400)
    if reps is None:
        return error_response("VALIDATION_ERROR", "reps must be a positive integer", 400)

    db = get_db()
    try:
        db.execute(
            """
            UPDATE texts
            SET name = ?, level = ?, reps = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (name, level, reps, text_id),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return error_response(
            "CONFLICT",
            "A text with that name already exists",
            409,
        )

    text = _get_owned_text(text_id)
    if text is None:
        return error_response("NOT_FOUND", "Text not found", 404)
    lines = _load_text_lines(text_id)
    return jsonify({"text": _text_payload(text, lines=lines, include_relations=True)})


@require_auth
def delete_text(text_id: int):
    text = _get_owned_text(text_id)
    if text is None:
        return error_response("NOT_FOUND", "Text not found", 404)

    db = get_db()
    db.execute("DELETE FROM texts WHERE id = ?", (text_id,))
    db.commit()
    return "", 204


@require_auth
def update_text_transcript(text_id: int):
    text = _get_owned_text(text_id)
    if text is None:
        return error_response("NOT_FOUND", "Text not found", 404)

    payload = request.get_json(silent=True) or {}
    transcript_raw = _transcript_from_payload(payload)
    if not isinstance(transcript_raw, str):
        transcript_raw = ""
    transcript_raw = transcript_raw.strip()

    if not transcript_raw:
        return error_response("VALIDATION_ERROR", "transcriptRaw is required", 400)

    parsed_lines = _parse_transcript_lines(transcript_raw)
    db = get_db()
    _replace_text_lines(
        db,
        text_id=text_id,
        transcript_raw=transcript_raw,
        parsed_lines=parsed_lines,
    )
    db.commit()

    updated = _get_owned_text(text_id)
    if updated is None:
        return error_response("NOT_FOUND", "Text not found", 404)
    lines = _load_text_lines(text_id)
    return jsonify({"text": _text_payload(updated, lines=lines, include_relations=True)})


@require_auth
def upload_text_clips(text_id: int):
    text = _get_owned_text(text_id)
    if text is None:
        return error_response("NOT_FOUND", "Text not found", 404)

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
    target_dir = _text_clip_dir(text_id)
    target_dir.mkdir(parents=True, exist_ok=True)

    db = get_db()
    for clip_index, original_name, file_storage in parsed_files:
        relative_path = _clip_storage_relative_path(text_id, clip_index)
        absolute_path = _clip_storage_absolute_path(text_id, clip_index)
        file_storage.save(str(absolute_path))
        db.execute(
            """
            INSERT INTO text_clips(
              text_id,
              clip_index,
              original_filename,
              storage_path,
              mime_type,
              trimmed
            )
            VALUES (?, ?, ?, ?, ?, 0)
            ON CONFLICT(text_id, clip_index)
            DO UPDATE SET
              original_filename = excluded.original_filename,
              storage_path = excluded.storage_path,
              mime_type = excluded.mime_type,
              created_at = datetime('now')
            """,
            (
                text_id,
                clip_index,
                original_name,
                relative_path,
                "audio/mpeg",
            ),
        )

    clip_count_row = db.execute(
        "SELECT COUNT(*) AS clip_count FROM text_clips WHERE text_id = ?",
        (text_id,),
    ).fetchone()
    clip_count = int(clip_count_row["clip_count"]) if clip_count_row else 0
    db.execute(
        """
        UPDATE texts
        SET clip_count = ?, is_ready = 0, updated_at = datetime('now')
        WHERE id = ?
        """,
        (clip_count, text_id),
    )
    db.commit()

    return jsonify(
        {
            "textId": text_id,
            "uploadedCount": len(parsed_files),
            "clipCount": clip_count,
            "uploadedIndexes": [item[0] for item in parsed_files],
        }
    )


@require_auth
def get_text_clip(text_id: int, clip_index: int):
    text = _get_owned_text(text_id)
    if text is None:
        return error_response("NOT_FOUND", "Text not found", 404)

    clip = _get_text_clip(text_id, clip_index)
    if clip is None:
        return error_response("NOT_FOUND", "Clip not found", 404)

    relative_path = clip["storage_path"]
    absolute_path = Path(current_app.config["CLIP_STORAGE_ROOT"]) / relative_path
    if not absolute_path.exists() or not absolute_path.is_file():
        return error_response("NOT_FOUND", "Clip file not found", 404)

    mime_type = clip["mime_type"] or "audio/mpeg"
    return send_file(absolute_path, mimetype=mime_type, conditional=True)


@require_auth
def validate_text_readiness(text_id: int):
    text = _get_owned_text(text_id)
    if text is None:
        return error_response("NOT_FOUND", "Text not found", 404)

    db = get_db()
    readiness = _validation_result(text_id, line_count=int(text["line_count"]))
    db.execute(
        """
        UPDATE texts
        SET clip_count = ?, is_ready = ?, updated_at = datetime('now')
        WHERE id = ?
        """,
        (readiness["clipCount"], int(readiness["isReady"]), text_id),
    )
    db.commit()

    return jsonify({"readiness": readiness})
