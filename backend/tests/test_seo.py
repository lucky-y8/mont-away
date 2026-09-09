"""SEO document and HTML shell coverage. / SEO 文档与 HTML 外壳测试。"""

import uuid

from fastapi.testclient import TestClient

from app.main import app


def test_static_seo_documents_and_english_shell():
    with TestClient(app) as client:
        robots = client.get("/robots.txt")
        assert robots.status_code == 200
        assert "Disallow: /admin" in robots.text
        assert "Sitemap:" in robots.text
        assert robots.headers["x-content-type-options"] == "nosniff"

        sitemap = client.get("/sitemap.xml")
        assert sitemap.status_code == 200
        assert sitemap.headers["content-type"].startswith("application/xml")
        assert "hreflang=\"zh-CN\"" in sitemap.text
        assert "hreflang=\"en\"" in sitemap.text

        english = client.get("/en/")
        assert english.status_code == 200
        assert "<html lang=\"en\"" in english.text
        assert "Mont Away | Discover Quiet Places" in english.text
        assert english.text.count('rel="canonical"') == 1
        assert 'hreflang="zh-CN"' in english.text

        api = client.get("/api/v1/posts")
        assert api.headers["cache-control"] == "no-store"
        assert api.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=(self), payment=()"
        assert client.get("/health", headers={"Host": "untrusted.example"}).status_code == 400


def test_missing_public_content_returns_noindex_html():
    missing_id = str(uuid.uuid4())
    with TestClient(app) as client:
        post = client.get(f"/posts/{missing_id}")
        assert post.status_code == 404
        assert 'content="noindex,nofollow"' in post.text

        place = client.get(f"/en/places/{missing_id}")
        assert place.status_code == 404
        assert "Place not found" in place.text
        assert 'content="noindex,nofollow"' in place.text
