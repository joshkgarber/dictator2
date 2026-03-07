from __future__ import annotations

import functools
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from flask import current_app, g, jsonify, request

from .db import get_db


def _utc_timestamp() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp())


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        600000,
    ).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verify_password(stored_hash: str, password: str) -> bool:
    try:
        _algorithm, salt, expected_digest = stored_hash.split("$", 2)
    except ValueError:
        return False

    candidate_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        600000,
    ).hex()
    return hmac.compare_digest(candidate_digest, expected_digest)


def error_response(code: str, message: str, status: int):
    return jsonify({"error": {"code": code, "message": message}}), status


def create_auth_session(user_id: int) -> tuple[str, str, datetime]:
    session_id = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(tz=timezone.utc) + timedelta(
        hours=current_app.config["AUTH_SESSION_TTL_HOURS"]
    )

    db = get_db()
    db.execute(
        """
        INSERT INTO auth_sessions(id, user_id, csrf_token, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            session_id,
            user_id,
            csrf_token,
            int(expires_at.timestamp()),
            _utc_timestamp(),
        ),
    )
    db.commit()
    return session_id, csrf_token, expires_at


def clear_auth_session(session_id: str) -> None:
    db = get_db()
    db.execute(
        "UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
        (_utc_timestamp(), session_id),
    )
    db.commit()


def set_auth_cookies(response, session_id: str, csrf_token: str, expires_at: datetime) -> None:
    expires = expires_at.astimezone(timezone.utc)
    response.set_cookie(
        current_app.config["SESSION_COOKIE_NAME"],
        session_id,
        httponly=True,
        samesite="Lax",
        secure=False,
        expires=expires,
        path="/",
    )
    response.set_cookie(
        "csrf_token",
        csrf_token,
        httponly=False,
        samesite="Lax",
        secure=False,
        expires=expires,
        path="/",
    )


def clear_auth_cookies(response) -> None:
    response.delete_cookie(current_app.config["SESSION_COOKIE_NAME"], path="/")
    response.delete_cookie("csrf_token", path="/")


def _load_authenticated_user() -> None:
    g.current_user = None
    g.current_session = None

    session_id = request.cookies.get(current_app.config["SESSION_COOKIE_NAME"])
    if not session_id:
        return

    db = get_db()
    session_row = db.execute(
        """
        SELECT
            s.id,
            s.user_id,
            s.csrf_token,
            s.expires_at,
            u.email,
            u.username,
            u.is_active
        FROM auth_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = ?
          AND s.revoked_at IS NULL
          AND s.expires_at > strftime('%s','now')
        """,
        (session_id,),
    ).fetchone()

    if session_row is None or not session_row["is_active"]:
        return

    g.current_session = {
        "id": session_row["id"],
        "user_id": session_row["user_id"],
        "csrf_token": session_row["csrf_token"],
    }
    g.current_user = {
        "id": session_row["user_id"],
        "email": session_row["email"],
        "username": session_row["username"],
    }


def _validate_csrf_for_mutations():
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return None
    if g.get("current_session") is None:
        return None

    expected = g.current_session["csrf_token"]
    provided = request.headers.get("X-CSRF-Token")
    if not provided or not hmac.compare_digest(expected, provided):
        return error_response("CSRF_ERROR", "Missing or invalid CSRF token", 403)
    return None


def require_auth(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        if g.get("current_user") is None:
            return error_response("UNAUTHORIZED", "Authentication required", 401)
        return view(*args, **kwargs)

    return wrapped


def init_auth(app) -> None:
    @app.before_request
    def load_auth_context():
        _load_authenticated_user()
        csrf_error = _validate_csrf_for_mutations()
        if csrf_error is not None:
            return csrf_error
        return None
