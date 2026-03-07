from flask import g, jsonify, make_response, request

from ..auth import (
    clear_auth_cookies,
    clear_auth_session,
    create_auth_session,
    error_response,
    hash_password,
    require_auth,
    set_auth_cookies,
    verify_password,
)
from ..db import get_db


def _normalize_credential(value: str | None) -> str:
    return (value or "").strip()


def _user_payload(user_row) -> dict:
    return {
        "id": user_row["id"],
        "email": user_row["email"],
        "username": user_row["username"],
    }


def register():
    payload = request.get_json(silent=True) or {}
    email = _normalize_credential(payload.get("email")).lower()
    username = _normalize_credential(payload.get("username"))
    password = payload.get("password") or ""

    if not email or not username or not password:
        return error_response(
            "VALIDATION_ERROR",
            "email, username, and password are required",
            400,
        )
    if len(password) < 8:
        return error_response(
            "VALIDATION_ERROR",
            "password must be at least 8 characters",
            400,
        )

    db = get_db()
    existing = db.execute(
        "SELECT id FROM users WHERE email = ? OR username = ?",
        (email, username),
    ).fetchone()
    if existing is not None:
        return error_response(
            "CONFLICT",
            "A user with that email or username already exists",
            409,
        )

    cursor = db.execute(
        "INSERT INTO users(email, username, password_hash) VALUES (?, ?, ?)",
        (email, username, hash_password(password)),
    )
    db.commit()

    user_id = cursor.lastrowid
    if user_id is None:
        return error_response("INTERNAL_ERROR", "Failed to create user", 500)
    user_id = int(user_id)
    user = db.execute(
        "SELECT id, email, username FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    if user is None:
        return error_response("INTERNAL_ERROR", "Failed to load user", 500)

    session_id, csrf_token, expires_at = create_auth_session(user_id)
    response = make_response(
        jsonify(
            {
                "user": _user_payload(user),
                "csrfToken": csrf_token,
            }
        ),
        201,
    )
    set_auth_cookies(response, session_id, csrf_token, expires_at)
    return response


def login():
    payload = request.get_json(silent=True) or {}
    email = _normalize_credential(payload.get("email")).lower()
    password = payload.get("password") or ""
    if not email or not password:
        return error_response("VALIDATION_ERROR", "email and password are required", 400)

    db = get_db()
    user = db.execute(
        "SELECT id, email, username, password_hash, is_active FROM users WHERE email = ?",
        (email,),
    ).fetchone()
    if user is None or not user["is_active"]:
        return error_response("INVALID_CREDENTIALS", "Invalid email or password", 401)
    if not verify_password(user["password_hash"], password):
        return error_response("INVALID_CREDENTIALS", "Invalid email or password", 401)

    if g.get("current_session") is not None:
        clear_auth_session(g.current_session["id"])

    session_id, csrf_token, expires_at = create_auth_session(user["id"])
    response = make_response(
        jsonify(
            {
                "user": _user_payload(user),
                "csrfToken": csrf_token,
            }
        )
    )
    set_auth_cookies(response, session_id, csrf_token, expires_at)
    return response


@require_auth
def logout():
    clear_auth_session(g.current_session["id"])
    response = make_response("", 204)
    clear_auth_cookies(response)
    return response


@require_auth
def me():
    return jsonify({"user": g.current_user})
