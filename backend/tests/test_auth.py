import uuid

from fastapi.testclient import TestClient

from app.main import app


def test_email_authentication_flow():
    email = f"test-{uuid.uuid4()}@example.com"
    password = "a-secure-test-password"
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        registered = client.post("/api/v1/auth/email/register", json={"email": email, "password": password})
        assert registered.status_code == 201
        verification_token = registered.json()["verification_token"]
        assert verification_token

        unverified = client.post("/api/v1/auth/email/login", json={"email": email, "password": password})
        assert unverified.status_code == 403

        verified = client.post("/api/v1/auth/email/verify", json={"token": verification_token})
        assert verified.status_code == 200

        login = client.post("/api/v1/auth/email/login", json={"email": email, "password": password})
        assert login.status_code == 200
        tokens = login.json()

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
        assert me.status_code == 200
        assert me.json()["email"] == email

        refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert refreshed.status_code == 200
        assert refreshed.json()["refresh_token"] != tokens["refresh_token"]
        assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401


def test_wechat_requires_configuration():
    with TestClient(app) as client:
        response = client.get("/api/v1/auth/wechat/start", follow_redirects=False)
        assert response.status_code == 503
