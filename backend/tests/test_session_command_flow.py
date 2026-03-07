def test_session_event_commands_dispatch_and_misspelled_commands_remain_attempts(
    client,
    create_ready_text,
    auth_headers,
):
    text_id = create_ready_text(lines=["Das ist ein Testsatz."])

    start_response = client.post(
        f"/api/texts/{text_id}/sessions",
        json={"reps": 1},
        headers=auth_headers,
    )
    assert start_response.status_code == 201
    session_id = int(start_response.get_json()["session"]["id"])

    misspelled_attempt = client.post(
        f"/api/sessions/{session_id}/attempts",
        json={"attemptText": "replaay"},
        headers=auth_headers,
    )
    assert misspelled_attempt.status_code == 200
    misspelled_payload = misspelled_attempt.get_json()
    assert misspelled_payload["attempt"]["isCorrect"] is False
    assert misspelled_payload["session"]["progress"]["cursor"] == 0

    events_before = misspelled_payload["session"]["events"]
    assert events_before == []

    help_event = client.post(
        f"/api/sessions/{session_id}/events",
        json={"eventType": "help"},
        headers=auth_headers,
    )
    assert help_event.status_code == 200
    help_payload = help_event.get_json()["event"]
    assert help_payload["eventType"] == "help"
    assert isinstance(help_payload["payload"]["commands"], list)


def test_keep_command_advances_session_after_incorrect_attempt(client, create_ready_text, auth_headers):
    text_id = create_ready_text(lines=["eins", "zwei"])

    start_response = client.post(
        f"/api/texts/{text_id}/sessions",
        json={"reps": 1},
        headers=auth_headers,
    )
    assert start_response.status_code == 201
    session_id = int(start_response.get_json()["session"]["id"])

    wrong_attempt = client.post(
        f"/api/sessions/{session_id}/attempts",
        json={"attemptText": "falsch"},
        headers=auth_headers,
    )
    assert wrong_attempt.status_code == 200
    assert wrong_attempt.get_json()["attempt"]["isCorrect"] is False

    keep_event = client.post(
        f"/api/sessions/{session_id}/events",
        json={"eventType": "keep"},
        headers=auth_headers,
    )
    assert keep_event.status_code == 200
    keep_payload = keep_event.get_json()
    assert keep_payload["event"]["eventType"] == "keep"
    assert keep_payload["event"]["payload"]["keptWasCorrect"] is False
    assert keep_payload["session"]["progress"]["cursor"] == 1
