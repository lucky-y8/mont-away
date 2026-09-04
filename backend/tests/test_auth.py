import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.config import settings


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
        assert me.json()["is_admin"] is False

        refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert refreshed.status_code == 200
        assert refreshed.json()["refresh_token"] != tokens["refresh_token"]
        assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401


def test_wechat_requires_configuration():
    with TestClient(app) as client:
        response = client.get("/api/v1/auth/wechat/start", follow_redirects=False)
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "wechat_not_configured"


def test_errors_follow_accept_language():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/email/login",
            headers={"Accept-Language": "en-US,en;q=0.9"},
            json={"email": "missing@example.com", "password": "not-the-right-password"},
        )
        assert response.status_code == 401
        assert response.headers["content-language"] == "en"
        assert response.json() == {"error": {"code": "invalid_credentials", "message": "The email or password is incorrect."}}

        japanese = client.post(
            "/api/v1/auth/email/login",
            headers={"Accept-Language": "ja-JP"},
            json={"email": "missing@example.com", "password": "not-the-right-password"},
        )
        assert japanese.headers["content-language"] == "ja"
        assert japanese.json()["error"]["message"] == "メールアドレスまたはパスワードが正しくありません。"


def test_validation_errors_are_localized_and_stable():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/email/register",
            headers={"Accept-Language": "zh-CN"},
            json={"email": "bad", "password": "short"},
        )
        error = response.json()["error"]
        assert response.status_code == 422
        assert error["code"] == "validation_error"
        assert error["message"] == "请求参数不符合要求。"
        assert {item["path"] for item in error["fields"]} == {"body.email", "body.password"}


def verified_user(client: TestClient) -> dict:
    email = f"author-{uuid.uuid4()}@example.com"
    payload = {"email": email, "password": "a-secure-test-password"}
    registration = client.post("/api/v1/auth/email/register", json=payload).json()
    client.post("/api/v1/auth/email/verify", json={"token": registration["verification_token"]})
    return client.post("/api/v1/auth/email/login", json=payload).json()


def test_publish_search_and_idempotent_like_flow():
    with TestClient(app) as client:
        tokens = verified_user(client)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        payload = {
            "title": "湖边测试路线",
            "body": "这是一条用于自动测试的路线。",
            "content_language": "zh-CN",
            "transport_mode": "walk",
            "route_source": "mixed",
            "place": {"name": "测试湖", "city": "杭州", "country_code": "CN", "latitude": 30.25, "longitude": 120.15},
            "route": {
                "start": {"name": "环线入口", "latitude": 30.25, "longitude": 120.15},
                "end": {"name": "环线入口", "latitude": 30.25, "longitude": 120.15},
                "distance_meters": 1800,
                "nodes": [{"name": "休息点", "description": "树荫下", "latitude": 30.251, "longitude": 120.151, "source": "edited"}],
            },
        }
        created = client.post("/api/v1/posts", headers=headers, json=payload)
        assert created.status_code == 201
        post = created.json()
        assert post["visibility_status"] == "public"
        assert post["moderation_status"] == "pending"
        assert post["reward_status"] == "pending"
        assert post["route"]["start"] == post["route"]["end"]

        results = client.get("/api/v1/posts", params={"search": "测试湖"}).json()
        assert any(item["id"] == post["id"] for item in results)
        first_like = client.post(f"/api/v1/posts/{post['id']}/likes", headers=headers).json()
        second_like = client.post(f"/api/v1/posts/{post['id']}/likes", headers=headers).json()
        assert first_like["like_count"] == second_like["like_count"] == 1
        ranked = client.get("/api/v1/posts", params={"sort": "popular"}, headers=headers).json()
        assert ranked[0]["id"] == post["id"]
        assert ranked[0]["liked_by_me"] is True
        unliked = client.delete(f"/api/v1/posts/{post['id']}/likes", headers=headers).json()
        assert unliked["like_count"] == 0


def test_admin_approval_notifies_and_rewards_once():
    with TestClient(app) as client:
        author_tokens = verified_user(client)
        admin_email = "admin@example.com"
        admin_payload = {"email": admin_email, "password": "a-secure-admin-password"}
        admin_registration = client.post("/api/v1/auth/email/register", json=admin_payload).json()
        client.post("/api/v1/auth/email/verify", json={"token": admin_registration["verification_token"]})
        admin_tokens = client.post("/api/v1/auth/email/login", json=admin_payload).json()
        author_headers = {"Authorization": f"Bearer {author_tokens['access_token']}"}
        admin_headers = {"Authorization": f"Bearer {admin_tokens['access_token']}", "Accept-Language": "en"}
        post_payload = {
            "title": "Moderation test",
            "body": "A route awaiting review.",
            "content_language": "en",
            "route_source": "manual",
            "place": {"name": "Review Lake", "city": "Hangzhou", "country_code": "CN", "latitude": 30.2, "longitude": 120.1},
            "route": {"start": {"name": "Start", "latitude": 30.2, "longitude": 120.1}, "end": {"name": "End", "latitude": 30.21, "longitude": 120.11}},
        }
        post = client.post("/api/v1/posts", headers=author_headers, json=post_payload).json()
        assert client.get("/api/v1/auth/me", headers=admin_headers).json()["is_admin"] is True
        settings.post_reward_points = 25
        try:
            approved = client.post(f"/api/v1/admin/posts/{post['id']}/approve", headers=admin_headers, json={"reason": "Looks good"})
            assert approved.status_code == 200
            assert approved.json()["message"] == "The post has been approved."
            client.post(f"/api/v1/admin/posts/{post['id']}/approve", headers=admin_headers, json={"reason": "Second review"})
            points = client.get("/api/v1/account/points", headers=author_headers).json()
            assert points["balance"] == 25
            assert len(points["entries"]) == 1
            notifications = client.get("/api/v1/account/notifications", headers={**author_headers, "Accept-Language": "zh-CN"}).json()
            assert notifications[0]["event_type"] == "post_approved"
            assert "审核" in notifications[0]["message"]
        finally:
            settings.post_reward_points = None
