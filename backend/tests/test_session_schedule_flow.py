def test_session_completion_and_schedule_reschedule_flow(client, create_ready_text, auth_headers):
    text_id = create_ready_text(lines=["Das ist ein Testsatz."])

    start_response = client.post(
        f"/api/texts/{text_id}/sessions",
        json={"reps": 1},
        headers=auth_headers,
    )
    assert start_response.status_code == 201
    session_id = int(start_response.get_json()["session"]["id"])

    attempt_response = client.post(
        f"/api/sessions/{session_id}/attempts",
        json={"attemptText": "Das ist ein Testsatz."},
        headers=auth_headers,
    )
    assert attempt_response.status_code == 200
    assert attempt_response.get_json()["attempt"]["isCorrect"] is True

    complete_response = client.post(
        f"/api/sessions/{session_id}/complete",
        json={},
        headers=auth_headers,
    )
    assert complete_response.status_code == 200
    assert complete_response.get_json()["session"]["status"] == "completed"

    first_schedule_response = client.put(
        f"/api/texts/{text_id}/schedule",
        json={"nextSessionDate": "2030-04-01", "notes": "review verbs"},
        headers=auth_headers,
    )
    assert first_schedule_response.status_code == 200
    first_schedule = first_schedule_response.get_json()["schedule"]
    assert first_schedule["nextSessionDate"] == "2030-04-01"
    assert first_schedule["notes"] == "review verbs"

    reschedule_response = client.put(
        f"/api/texts/{text_id}/schedule",
        json={"nextSessionDate": "2030-04-08", "notes": "focus pronunciation"},
        headers=auth_headers,
    )
    assert reschedule_response.status_code == 200
    reschedule = reschedule_response.get_json()["schedule"]
    assert reschedule["id"] == first_schedule["id"]
    assert reschedule["nextSessionDate"] == "2030-04-08"
    assert reschedule["notes"] == "focus pronunciation"

    schedule_response = client.get("/api/schedule")
    assert schedule_response.status_code == 200
    schedule_payload = schedule_response.get_json()
    assert schedule_payload["counts"]["all"] == 1
    assert schedule_payload["counts"]["upcoming"] == 1
    assert schedule_payload["schedule"][0]["textId"] == text_id
