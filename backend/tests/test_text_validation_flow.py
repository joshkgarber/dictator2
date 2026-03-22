from io import BytesIO


def test_validate_text_readiness_detects_missing_clip_indexes(client, create_text, auth_headers):
    text_id = create_text(
        name="Validation Text",
        level="A1",
        transcript_raw="line one\nline two",
    )

    upload_response = client.post(
        f"/api/texts/{text_id}/clips",
        data={"clips": (BytesIO(b"ID3-only-first"), "c-1.mp3")},
        content_type="multipart/form-data",
        headers=auth_headers,
    )
    assert upload_response.status_code == 200

    validate_response = client.post(f"/api/texts/{text_id}/validate", headers=auth_headers)
    assert validate_response.status_code == 200
    readiness = validate_response.get_json()["readiness"]
    assert readiness["lineCount"] == 2
    assert readiness["clipCount"] == 1
    assert readiness["missingIndexes"] == [2]
    assert readiness["isReady"] is False

    second_upload = client.post(
        f"/api/texts/{text_id}/clips",
        data={"clips": (BytesIO(b"ID3-second"), "c-2.mp3")},
        content_type="multipart/form-data",
        headers=auth_headers,
    )
    assert second_upload.status_code == 200

    final_validate = client.post(f"/api/texts/{text_id}/validate", headers=auth_headers)
    assert final_validate.status_code == 200
    final_readiness = final_validate.get_json()["readiness"]
    assert final_readiness["missingIndexes"] == []
    assert final_readiness["isReady"] is True


def test_clip_upload_rejects_invalid_filename_and_non_mp3_signature(client, create_text, auth_headers):
    text_id = create_text(
        name="Invalid Clip Upload",
        level="A1",
        transcript_raw="eins",
    )

    bad_name_response = client.post(
        f"/api/texts/{text_id}/clips",
        data={"clips": (BytesIO(b"ID3-data"), "clip-1.mp3")},
        content_type="multipart/form-data",
        headers=auth_headers,
    )
    assert bad_name_response.status_code == 400
    assert "c-<index>.mp3" in bad_name_response.get_json()["error"]["message"]

    bad_signature_response = client.post(
        f"/api/texts/{text_id}/clips",
        data={"clips": (BytesIO(b"not-an-mp3"), "c-1.mp3")},
        content_type="multipart/form-data",
        headers=auth_headers,
    )
    assert bad_signature_response.status_code == 400
    assert "Invalid MP3 file" in bad_signature_response.get_json()["error"]["message"]


def test_create_text_with_reps_field(client, auth_headers):
    """Test that text creation accepts and stores reps field"""
    response = client.post(
        "/api/texts",
        json={"name": "Text with Reps", "level": "B1", "transcriptRaw": "line one\nline two", "reps": 3},
        headers=auth_headers,
    )
    assert response.status_code == 201
    text = response.get_json()["text"]
    assert text["reps"] == 3
    assert text["name"] == "Text with Reps"


def test_create_text_defaults_reps_to_one(client, auth_headers):
    """Test that text creation defaults reps to 1 when not provided"""
    response = client.post(
        "/api/texts",
        json={"name": "Text Default Reps", "level": "A1", "transcriptRaw": "single line"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    text = response.get_json()["text"]
    assert text["reps"] == 1


def test_create_text_rejects_invalid_reps(client, auth_headers):
    """Test that text creation rejects invalid reps values"""
    response = client.post(
        "/api/texts",
        json={"name": "Invalid Reps", "level": "A1", "transcriptRaw": "line", "reps": 0},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "reps must be a positive integer" in response.get_json()["error"]["message"]

    response = client.post(
        "/api/texts",
        json={"name": "Invalid Reps 2", "level": "A1", "transcriptRaw": "line", "reps": -1},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "reps must be a positive integer" in response.get_json()["error"]["message"]


def test_update_text_reps_field(client, create_text, auth_headers):
    """Test that text update accepts and updates reps field"""
    text_id = create_text(name="Update Reps Test", transcript_raw="line one")
    
    # First verify default reps is 1
    get_response = client.get(f"/api/texts/{text_id}", headers=auth_headers)
    assert get_response.status_code == 200
    assert get_response.get_json()["text"]["reps"] == 1
    
    # Update reps to 5
    update_response = client.patch(
        f"/api/texts/{text_id}",
        json={"reps": 5},
        headers=auth_headers,
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["text"]["reps"] == 5
    
    # Verify it's persisted
    get_response2 = client.get(f"/api/texts/{text_id}", headers=auth_headers)
    assert get_response2.status_code == 200
    assert get_response2.get_json()["text"]["reps"] == 5


def test_update_text_rejects_invalid_reps(client, create_text, auth_headers):
    """Test that text update rejects invalid reps values"""
    text_id = create_text(name="Invalid Update Reps", transcript_raw="line")
    
    update_response = client.patch(
        f"/api/texts/{text_id}",
        json={"reps": 0},
        headers=auth_headers,
    )
    assert update_response.status_code == 400
    assert "reps must be a positive integer" in update_response.get_json()["error"]["message"]


def test_list_texts_includes_reps(client, create_text, auth_headers):
    """Test that list texts endpoint includes reps field"""
    text_id = create_text(name="List Reps Test", transcript_raw="line one\nline two", level="B2")
    
    # Update the text to have reps = 3
    client.patch(
        f"/api/texts/{text_id}",
        json={"reps": 3},
        headers=auth_headers,
    )
    
    # List texts and verify reps is included
    list_response = client.get("/api/texts", headers=auth_headers)
    assert list_response.status_code == 200
    texts = list_response.get_json()["texts"]
    
    # Find our text in the list
    our_text = next((t for t in texts if t["id"] == text_id), None)
    assert our_text is not None
    assert our_text["reps"] == 3
