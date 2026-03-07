def test_register_login_me_logout_flow(client):
    register_response = client.post(
        "/api/auth/register",
        json={
            "email": "student@example.com",
            "username": "student",
            "password": "secret123",
        },
    )
    assert register_response.status_code == 201
    register_payload = register_response.get_json()
    assert register_payload["user"]["email"] == "student@example.com"
    csrf_token = register_payload["csrfToken"]

    me_response = client.get("/api/auth/me")
    assert me_response.status_code == 200
    assert me_response.get_json()["user"]["username"] == "student"

    logout_response = client.post(
        "/api/auth/logout",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert logout_response.status_code == 204

    unauthorized_me = client.get("/api/auth/me")
    assert unauthorized_me.status_code == 401

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "student@example.com",
            "password": "secret123",
        },
    )
    assert login_response.status_code == 200
    assert login_response.get_json()["user"]["username"] == "student"
