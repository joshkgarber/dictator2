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
