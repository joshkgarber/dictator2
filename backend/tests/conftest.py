from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest

try:
    from app import create_app
    from app.db import get_db
except ModuleNotFoundError:  # pragma: no cover
    from backend.app import create_app
    from backend.app.db import get_db


@pytest.fixture
def app(tmp_path: Path):
    database_path = tmp_path / "test.sqlite3"
    clip_root = tmp_path / "clips"

    flask_app = create_app(
        {
            "TESTING": True,
            "DATABASE": str(database_path),
            "CLIP_STORAGE_ROOT": str(clip_root),
            "SECRET_KEY": "test-secret",
        }
    )

    yield flask_app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def register_user(client):
    def _register_user(
        *,
        email: str = "learner@example.com",
        username: str = "learner",
        password: str = "secret123",
    ) -> dict:
        response = client.post(
            "/api/auth/register",
            json={"email": email, "username": username, "password": password},
        )
        assert response.status_code == 201
        return response.get_json()

    return _register_user


@pytest.fixture
def auth_headers(register_user):
    payload = register_user()
    return {"X-CSRF-Token": payload["csrfToken"]}


@pytest.fixture
def create_text(client, auth_headers):
    def _create_text(*, name: str = "Unit Text", level: str = "A1", transcript_raw: str = "eins") -> int:
        response = client.post(
            "/api/texts",
            json={"name": name, "level": level, "transcriptRaw": transcript_raw},
            headers=auth_headers,
        )
        assert response.status_code == 201
        return int(response.get_json()["text"]["id"])

    return _create_text


@pytest.fixture
def create_ready_text(client, create_text, auth_headers):
    def _create_ready_text(
        *,
        name: str = "Ready Text",
        level: str = "A1",
        lines: list[str] | None = None,
    ) -> int:
        transcript_lines = lines or ["Das ist ein Testsatz."]
        transcript_raw = "\n".join(transcript_lines)
        text_id = create_text(name=name, level=level, transcript_raw=transcript_raw)

        upload_payload = {}
        for clip_index in range(1, len(transcript_lines) + 1):
            upload_payload[f"clips_{clip_index}"] = (
                BytesIO(bytes(f"ID3-test-{clip_index}", "utf-8")),
                f"c-{clip_index}.mp3",
            )

        upload_response = client.post(
            f"/api/texts/{text_id}/clips",
            data=upload_payload,
            content_type="multipart/form-data",
            headers=auth_headers,
        )
        assert upload_response.status_code == 200

        validation_response = client.post(f"/api/texts/{text_id}/validate", headers=auth_headers)
        assert validation_response.status_code == 200
        assert validation_response.get_json()["readiness"]["isReady"] is True

        return text_id

    return _create_ready_text


@pytest.fixture
def get_user_id(app):
    def _get_user_id(email: str) -> int:
        with app.app_context():
            db = get_db()
            row = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
            assert row is not None
            return int(row["id"])

    return _get_user_id
