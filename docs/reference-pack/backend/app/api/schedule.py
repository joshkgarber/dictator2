from datetime import datetime

from flask import g, jsonify, request

from ..auth import error_response, require_auth
from ..db import get_db


def _parse_schedule_date(value) -> str | None:
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


def _normalize_optional_text(value) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    return cleaned


def _get_owned_chapter(chapter_id: int):
    db = get_db()
    return db.execute(
        """
        SELECT
          c.id,
          c.story_id,
          c.chapter_code,
          c.title,
          c.is_ready,
          st.name AS story_name,
          st.level_code AS story_level
        FROM chapters c
        JOIN stories st ON st.id = c.story_id
        WHERE c.id = ? AND st.user_id = ?
        """,
        (chapter_id, g.current_user["id"]),
    ).fetchone()


def _schedule_payload(row) -> dict:
    return {
        "id": int(row["id"]),
        "chapterId": int(row["chapter_id"]),
        "nextSessionDate": row["next_session_date"],
        "notes": row["notes"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "dueStatus": row["due_status"],
        "chapter": {
            "id": int(row["chapter_id"]),
            "storyId": int(row["story_id"]),
            "storyName": row["story_name"],
            "storyLevel": row["story_level"],
            "chapterCode": row["chapter_code"],
            "title": row["chapter_title"],
            "isReady": bool(row["is_ready"]),
        },
    }


def _load_schedule_record(chapter_id: int):
    db = get_db()
    return db.execute(
        """
        SELECT
          cs.id,
          cs.chapter_id,
          cs.next_session_date,
          cs.notes,
          cs.created_at,
          cs.updated_at,
          CASE
            WHEN cs.next_session_date <= date('now') THEN 'due'
            ELSE 'upcoming'
          END AS due_status,
          c.story_id,
          c.chapter_code,
          c.title AS chapter_title,
          c.is_ready,
          st.name AS story_name,
          st.level_code AS story_level
        FROM chapter_schedules cs
        JOIN chapters c ON c.id = cs.chapter_id
        JOIN stories st ON st.id = c.story_id
        WHERE cs.user_id = ? AND cs.chapter_id = ?
        """,
        (g.current_user["id"], chapter_id),
    ).fetchone()


@require_auth
def list_schedule():
    scope = (request.args.get("scope") or "all").strip().lower()
    if scope not in {"all", "due", "upcoming"}:
        return error_response("VALIDATION_ERROR", "scope must be one of all, due, upcoming", 400)

    where_parts = ["cs.user_id = ?"]
    values = [g.current_user["id"]]
    if scope == "due":
        where_parts.append("cs.next_session_date <= date('now')")
    elif scope == "upcoming":
        where_parts.append("cs.next_session_date > date('now')")

    where_clause = " AND ".join(where_parts)
    db = get_db()
    rows = db.execute(
        f"""
        SELECT
          cs.id,
          cs.chapter_id,
          cs.next_session_date,
          cs.notes,
          cs.created_at,
          cs.updated_at,
          CASE
            WHEN cs.next_session_date <= date('now') THEN 'due'
            ELSE 'upcoming'
          END AS due_status,
          c.story_id,
          c.chapter_code,
          c.title AS chapter_title,
          c.is_ready,
          st.name AS story_name,
          st.level_code AS story_level
        FROM chapter_schedules cs
        JOIN chapters c ON c.id = cs.chapter_id
        JOIN stories st ON st.id = c.story_id
        WHERE {where_clause}
        ORDER BY
          CASE WHEN cs.next_session_date <= date('now') THEN 0 ELSE 1 END,
          cs.next_session_date ASC,
          datetime(cs.updated_at) DESC,
          cs.id DESC
        """,
        tuple(values),
    ).fetchall()

    counts_row = db.execute(
        """
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN next_session_date <= date('now') THEN 1 ELSE 0 END) AS due_count,
          SUM(CASE WHEN next_session_date > date('now') THEN 1 ELSE 0 END) AS upcoming_count
        FROM chapter_schedules
        WHERE user_id = ?
        """,
        (g.current_user["id"],),
    ).fetchone()

    due_count = int(counts_row["due_count"] or 0) if counts_row else 0
    upcoming_count = int(counts_row["upcoming_count"] or 0) if counts_row else 0
    total = int(counts_row["total"] or 0) if counts_row else 0

    return jsonify(
        {
            "today": datetime.utcnow().strftime("%Y-%m-%d"),
            "scope": scope,
            "counts": {
                "all": total,
                "due": due_count,
                "upcoming": upcoming_count,
            },
            "schedule": [_schedule_payload(row) for row in rows],
        }
    )


@require_auth
def upsert_chapter_schedule(chapter_id: int):
    chapter = _get_owned_chapter(chapter_id)
    if chapter is None:
        return error_response("NOT_FOUND", "Chapter not found", 404)

    payload = request.get_json(silent=True) or {}
    next_session_date = _parse_schedule_date(payload.get("nextSessionDate"))
    if next_session_date is None:
        return error_response("VALIDATION_ERROR", "nextSessionDate must be YYYY-MM-DD", 400)
    notes = _normalize_optional_text(payload.get("notes"))

    db = get_db()
    db.execute(
        """
        INSERT INTO chapter_schedules(user_id, chapter_id, next_session_date, notes)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, chapter_id)
        DO UPDATE SET
          next_session_date = excluded.next_session_date,
          notes = excluded.notes,
          updated_at = datetime('now')
        """,
        (g.current_user["id"], chapter_id, next_session_date, notes),
    )
    db.commit()

    schedule_row = _load_schedule_record(chapter_id)
    if schedule_row is None:
        return error_response("INTERNAL_ERROR", "Failed to load chapter schedule", 500)
    return jsonify({"schedule": _schedule_payload(schedule_row)})


@require_auth
def delete_chapter_schedule(chapter_id: int):
    chapter = _get_owned_chapter(chapter_id)
    if chapter is None:
        return error_response("NOT_FOUND", "Chapter not found", 404)

    db = get_db()
    db.execute(
        "DELETE FROM chapter_schedules WHERE user_id = ? AND chapter_id = ?",
        (g.current_user["id"], chapter_id),
    )
    db.commit()
    return "", 204
