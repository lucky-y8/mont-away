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
        reused = client.post("/api/v1/auth/email/verify", json={"token": verification_token})
        assert reused.status_code == 401
        assert reused.json()["error"]["code"] == "invalid_verification_token"

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


def test_password_reset_is_one_time_and_revokes_existing_sessions():
    email = f"reset-{uuid.uuid4()}@example.com"
    old_password = "old-secure-test-password"
    new_password = "new-secure-test-password"
    with TestClient(app) as client:
        registration = client.post("/api/v1/auth/email/register", json={"email": email, "password": old_password}).json()
        client.post("/api/v1/auth/email/verify", json={"token": registration["verification_token"]})
        old_session = client.post("/api/v1/auth/email/login", json={"email": email, "password": old_password}).json()

        requested = client.post("/api/v1/auth/email/password/forgot", headers={"Accept-Language": "en"}, json={"email": email})
        assert requested.status_code == 200
        assert requested.json()["code"] == "password_reset_requested"
        reset_token = requested.json()["reset_token"]
        assert reset_token

        reset = client.post("/api/v1/auth/email/password/reset", json={"token": reset_token, "password": new_password})
        assert reset.status_code == 200
        assert reset.json()["code"] == "password_reset"
        reused = client.post("/api/v1/auth/email/password/reset", json={"token": reset_token, "password": old_password})
        assert reused.status_code == 401
        assert reused.json()["error"]["code"] == "invalid_password_reset_token"
        assert client.post("/api/v1/auth/refresh", json={"refresh_token": old_session["refresh_token"]}).status_code == 401
        assert client.post("/api/v1/auth/email/login", json={"email": email, "password": old_password}).status_code == 401
        assert client.post("/api/v1/auth/email/login", json={"email": email, "password": new_password}).status_code == 200

        # Unknown accounts receive the same public response and never expose a token. / 未注册邮箱也返回同样文案，且不会暴露令牌。
        unknown = client.post("/api/v1/auth/email/password/forgot", headers={"Accept-Language": "en"}, json={"email": f"missing-{uuid.uuid4()}@example.com"})
        assert unknown.status_code == 200
        assert unknown.json()["message"] == requested.json()["message"]
        assert unknown.json()["reset_token"] is None


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
        uploaded = client.post(
            "/api/v1/media",
            headers=headers,
            files={"file": ("route.webp", b"test-image-bytes", "image/webp")},
        )
        assert uploaded.status_code == 201
        assert uploaded.json()["url"].startswith("http://testserver/media/")
        payload = {
            "title": "湖边测试路线",
            "body": "这是一条用于自动测试的路线。",
            "content_language": "zh-CN",
            "transport_mode": "walk",
            "route_source": "mixed",
            "media_ids": [uploaded.json()["id"]],
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
        assert post["media"][0]["id"] == uploaded.json()["id"]

        updated_payload = {**payload, "title": "湖边测试路线（已编辑）"}
        updated = client.patch(f"/api/v1/posts/{post['id']}", headers=headers, json=updated_payload)
        assert updated.status_code == 200
        assert updated.json()["title"].endswith("（已编辑）")
        assert updated.json()["media"][0]["url"] == post["media"][0]["url"]
        assert updated.json()["media"][0]["id"] != post["media"][0]["id"]

        reader_tokens = verified_user(client)
        reader_headers = {"Authorization": f"Bearer {reader_tokens['access_token']}"}
        comment = client.post(f"/api/v1/posts/{post['id']}/comments", headers=reader_headers, json={"body": "路线很实用"})
        assert comment.status_code == 201
        assert client.get(f"/api/v1/posts/{post['id']}/comments").json()[0]["body"] == "路线很实用"
        assert client.post(f"/api/v1/posts/{post['id']}/bookmarks", headers=reader_headers).status_code == 200
        assert client.get("/api/v1/account/bookmarks", headers=reader_headers).json()[0]["bookmarked_by_me"] is True
        assert client.post(f"/api/v1/posts/{post['id']}/reports", headers=reader_headers, json={"category": "other", "reason": "自动测试举报"}).status_code == 201
        assert client.delete(f"/api/v1/posts/{post['id']}/comments/{comment.json()['id']}", headers=reader_headers).status_code == 200

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

        draft_payload = {**payload, "title": "尚未发布的草稿", "publish": False, "media_ids": []}
        draft = client.post("/api/v1/posts", headers=headers, json=draft_payload).json()
        assert draft["visibility_status"] == "draft"
        assert all(item["id"] != draft["id"] for item in client.get("/api/v1/posts").json())
        assert any(item["id"] == draft["id"] for item in client.get("/api/v1/posts/mine", headers=headers).json())
        published = client.patch(f"/api/v1/posts/{draft['id']}", headers=headers, json={**draft_payload, "publish": True}).json()
        assert published["visibility_status"] == "public"
        assert published["moderation_status"] == "pending"


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
        client.post(f"/api/v1/posts/{post['id']}/reports", headers=author_headers, json={"category": "other", "reason": "Review this"})
        report = client.get("/api/v1/admin/reports", headers=admin_headers).json()[0]
        resolved = client.post(f"/api/v1/admin/reports/{report['id']}/resolve", headers=admin_headers, json={"resolution": "Reviewed"})
        assert resolved.status_code == 200
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


def test_admin_can_ban_and_unban_a_non_admin_account():
    with TestClient(app) as client:
        user_email = f"ban-target-{uuid.uuid4()}@example.com"
        user_password = "a-secure-user-password"
        registration = client.post("/api/v1/auth/email/register", json={"email": user_email, "password": user_password}).json()
        client.post("/api/v1/auth/email/verify", json={"token": registration["verification_token"]})
        user_tokens = client.post("/api/v1/auth/email/login", json={"email": user_email, "password": user_password}).json()
        user_headers = {"Authorization": f"Bearer {user_tokens['access_token']}", "Accept-Language": "en"}
        user_id = client.get("/api/v1/auth/me", headers=user_headers).json()["id"]

        admin_payload = {"email": "admin@example.com", "password": "a-secure-admin-password"}
        admin_registration = client.post("/api/v1/auth/email/register", json=admin_payload)
        if admin_registration.status_code == 201:
            client.post("/api/v1/auth/email/verify", json={"token": admin_registration.json()["verification_token"]})
        admin_tokens = client.post("/api/v1/auth/email/login", json=admin_payload).json()
        admin_headers = {"Authorization": f"Bearer {admin_tokens['access_token']}", "Accept-Language": "en"}

        banned = client.post(f"/api/v1/admin/users/{user_id}/ban", headers=admin_headers, json={"reason": "Repeated unsafe content", "duration_hours": 24})
        assert banned.status_code == 200
        assert banned.json()["code"] == "user_banned"
        blocked = client.get("/api/v1/auth/me", headers=user_headers)
        assert blocked.status_code == 403
        assert blocked.json()["error"]["code"] == "account_banned_until"
        assert blocked.json()["error"]["details"]["reason"] == "Repeated unsafe content"
        assert client.post("/api/v1/auth/refresh", json={"refresh_token": user_tokens["refresh_token"]}).status_code == 401
        assert client.post("/api/v1/auth/email/login", headers={"Accept-Language": "en"}, json={"email": user_email, "password": user_password}).status_code == 403
        users = client.get("/api/v1/admin/users", headers=admin_headers).json()
        assert next(item for item in users if item["id"] == user_id)["is_banned"] is True

        unbanned = client.post(f"/api/v1/admin/users/{user_id}/unban", headers=admin_headers)
        assert unbanned.status_code == 200
        fresh_tokens = client.post("/api/v1/auth/email/login", json={"email": user_email, "password": user_password}).json()
        notifications = client.get("/api/v1/account/notifications", headers={"Authorization": f"Bearer {fresh_tokens['access_token']}", "Accept-Language": "en"}).json()
        assert [item["event_type"] for item in notifications[:2]] == ["account_unbanned", "account_banned"]
