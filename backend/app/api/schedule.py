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


def _get_owned_text(text_id: int):
    db = get_db()
    return db.execute(
        """
        SELECT id, name, level, is_ready
        FROM texts
        WHERE id = ? AND user_id = ?
        """,
        (text_id, g.current_user["id"]),
    ).fetchone()


def _schedule_payload(row) -> dict:
    return {
        "id": int(row["id"]),
        "textId": int(row["text_id"]),
        "nextSessionDate": row["next_session_date"],
        "notes": row["notes"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "dueStatus": row["due_status"],
        "text": {
            "id": int(row["text_id"]),
            "name": row["text_name"],
            "level": row["text_level"],
            "isReady": bool(row["is_ready"]),
            "reps": int(row["reps"]),
        },
    }


def _load_schedule_record(text_id: int):
    db = get_db()
    return db.execute(
        """
        SELECT
          ts.id,
          ts.text_id,
          ts.next_session_date,
          ts.notes,
          ts.created_at,
          ts.updated_at,
          CASE
            WHEN ts.next_session_date <= date('now') THEN 'due'
            ELSE 'upcoming'
          END AS due_status,
          t.name AS text_name,
          t.level AS text_level,
          t.is_ready,
          t.reps
        FROM text_schedules ts
        JOIN texts t ON t.id = ts.text_id
        WHERE ts.user_id = ? AND ts.text_id = ?
        """,
        (g.current_user["id"], text_id),
    ).fetchone()


@require_auth
def list_schedule():
    scope = (request.args.get("scope") or "all").strip().lower()
    if scope not in {"all", "due", "upcoming"}:
        return error_response("VALIDATION_ERROR", "scope must be one of all, due, upcoming", 400)

    where_parts = ["ts.user_id = ?"]
    values = [g.current_user["id"]]
    if scope == "due":
        where_parts.append("ts.next_session_date <= date('now')")
    elif scope == "upcoming":
        where_parts.append("ts.next_session_date > date('now')")

    where_clause = " AND ".join(where_parts)
    db = get_db()
    rows = db.execute(
        f"""
        SELECT
          ts.id,
          ts.text_id,
          ts.next_session_date,
          ts.notes,
          ts.created_at,
          ts.updated_at,
          CASE
            WHEN ts.next_session_date <= date('now') THEN 'due'
            ELSE 'upcoming'
          END AS due_status,
          t.name AS text_name,
          t.level AS text_level,
          t.is_ready,
          t.reps
        FROM text_schedules ts
        JOIN texts t ON t.id = ts.text_id
        WHERE {where_clause}
        ORDER BY
          CASE WHEN ts.next_session_date <= date('now') THEN 0 ELSE 1 END,
          ts.next_session_date ASC,
          datetime(ts.updated_at) DESC,
          ts.id DESC
        """,
        tuple(values),
    ).fetchall()

    counts_row = db.execute(
        """
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN next_session_date <= date('now') THEN 1 ELSE 0 END) AS due_count,
          SUM(CASE WHEN next_session_date > date('now') THEN 1 ELSE 0 END) AS upcoming_count
        FROM text_schedules
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
def upsert_text_schedule(text_id: int):
    text = _get_owned_text(text_id)
    if text is None:
        return error_response("NOT_FOUND", "Text not found", 404)

    payload = request.get_json(silent=True) or {}
    next_session_date = _parse_schedule_date(payload.get("nextSessionDate"))
    if next_session_date is None:
        return error_response("VALIDATION_ERROR", "nextSessionDate must be YYYY-MM-DD", 400)
    notes = _normalize_optional_text(payload.get("notes"))

    db = get_db()
    db.execute(
        """
        INSERT INTO text_schedules(user_id, text_id, next_session_date, notes)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, text_id)
        DO UPDATE SET
          next_session_date = excluded.next_session_date,
          notes = excluded.notes,
          updated_at = datetime('now')
        """,
        (g.current_user["id"], text_id, next_session_date, notes),
    )
    db.commit()

    schedule_row = _load_schedule_record(text_id)
    if schedule_row is None:
        return error_response("INTERNAL_ERROR", "Failed to load text schedule", 500)
    return jsonify({"schedule": _schedule_payload(schedule_row)})


@require_auth
def delete_text_schedule(text_id: int):
    text = _get_owned_text(text_id)
    if text is None:
        return error_response("NOT_FOUND", "Text not found", 404)

    db = get_db()
    db.execute(
        "DELETE FROM text_schedules WHERE user_id = ? AND text_id = ?",
        (g.current_user["id"], text_id),
    )
    db.commit()
    return "", 204
