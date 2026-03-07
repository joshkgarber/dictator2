from pathlib import Path

from backend.app.db import get_db


def test_session_and_schedule_flow(client, app, create_ready_chapter):
    register_response = client.post(
        "/api/auth/register",
        json={
            "email": "learner@example.com",
            "username": "learner",
            "password": "secret123",
        },
    )
    assert register_response.status_code == 201
    csrf_token = register_response.get_json()["csrfToken"]

    with app.app_context():
        db = get_db()
        user_row = db.execute(
            "SELECT id FROM users WHERE email = ?",
            ("learner@example.com",),
        ).fetchone()
        user_id = int(user_row["id"])

    chapter_id = create_ready_chapter(
        user_id=user_id,
        line_texts=["Das ist ein Testsatz."],
    )

    start_response = client.post(
        f"/api/chapters/{chapter_id}/sessions",
        json={"reps": 1},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert start_response.status_code == 201
    session = start_response.get_json()["session"]
    session_id = int(session["id"])

    attempt_response = client.post(
        f"/api/sessions/{session_id}/attempts",
        json={"attemptText": "Das ist ein Testsatz."},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert attempt_response.status_code == 200
    assert attempt_response.get_json()["attempt"]["isCorrect"] is True

    complete_response = client.post(
        f"/api/sessions/{session_id}/complete",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert complete_response.status_code == 200
    assert complete_response.get_json()["session"]["status"] == "completed"

    upsert_schedule_response = client.put(
        f"/api/chapters/{chapter_id}/schedule",
        json={"nextSessionDate": "2026-04-01", "notes": "review verbs"},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert upsert_schedule_response.status_code == 200
    assert upsert_schedule_response.get_json()["schedule"]["nextSessionDate"] == "2026-04-01"

    schedule_response = client.get("/api/schedule")
    assert schedule_response.status_code == 200
    payload = schedule_response.get_json()
    assert payload["counts"]["all"] == 1
    assert payload["schedule"][0]["chapterId"] == chapter_id


def test_session_payload_includes_clip_url_and_clip_endpoint_is_owner_scoped(
    client, app, create_ready_chapter
):
    register_response = client.post(
        "/api/auth/register",
        json={
            "email": "audio-owner@example.com",
            "username": "audioowner",
            "password": "secret123",
        },
    )
    assert register_response.status_code == 201
    csrf_token = register_response.get_json()["csrfToken"]

    with app.app_context():
        db = get_db()
        user_row = db.execute(
            "SELECT id FROM users WHERE email = ?",
            ("audio-owner@example.com",),
        ).fetchone()
        user_id = int(user_row["id"])

    chapter_id = create_ready_chapter(
        user_id=user_id,
        line_texts=["Eins.", "Zwei."],
    )

    clip_bytes = b"ID3\x04\x00\x00\x00\x00\x00\x0funit-test-audio"
    clip_path = Path(app.config["CLIP_STORAGE_ROOT"]) / f"{user_id}/{chapter_id}/c-1.mp3"
    clip_path.parent.mkdir(parents=True, exist_ok=True)
    clip_path.write_bytes(clip_bytes)

    start_response = client.post(
        f"/api/chapters/{chapter_id}/sessions",
        json={"reps": 1},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert start_response.status_code == 201
    session = start_response.get_json()["session"]
    assert session["current"]["clipUrl"] == f"/api/chapters/{chapter_id}/clips/1"

    clip_response = client.get(f"/api/chapters/{chapter_id}/clips/1")
    assert clip_response.status_code == 200
    assert clip_response.content_type.startswith("audio/mpeg")
    assert clip_response.get_data() == clip_bytes

    intruder_client = app.test_client()
    intruder_register = intruder_client.post(
        "/api/auth/register",
        json={
            "email": "intruder@example.com",
            "username": "intruder",
            "password": "secret123",
        },
    )
    assert intruder_register.status_code == 201

    forbidden_response = intruder_client.get(f"/api/chapters/{chapter_id}/clips/1")
    assert forbidden_response.status_code == 404
