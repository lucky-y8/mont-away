"""SEO document and HTML shell coverage. / SEO 文档与 HTML 外壳测试。"""

import uuid

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


def test_static_seo_documents_and_localized_core_shells():
    with TestClient(app) as client:
        site_url = settings.frontend_url.rstrip("/")
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
        assert f"{site_url}/contact" in sitemap.text

        english = client.get("/en/")
        assert english.status_code == 200
        assert "<html lang=\"en\"" in english.text
        assert "Mont Away | Discover Quiet Places" in english.text
        assert english.text.count('rel="canonical"') == 1
        assert 'hreflang="zh-CN"' in english.text
        assert '<meta name="application-name" content="Mont Away"' in english.text
        assert 'property="og:locale:alternate" content="zh_CN"' in english.text
        assert '"@type":"WebSite"' in english.text

        chinese_map = client.get("/map")
        assert chinese_map.status_code == 200
        assert "地图发现｜附近小众景点与旅行路线｜山遥" in chinese_map.text
        assert f'<link rel="canonical" href="{site_url}/map"' in chinese_map.text
        assert '"@type":"CollectionPage"' in chinese_map.text

        chinese_ranking = client.get("/ranking")
        assert chinese_ranking.status_code == 200
        assert "热门旅行地点与游记榜单｜山遥" in chinese_ranking.text
        assert f'<link rel="canonical" href="{site_url}/ranking"' in chinese_ranking.text

        japanese_contact = client.get("/ja/contact")
        assert japanese_contact.status_code == 200
        assert "お問い合わせ｜山遥" in japanese_contact.text
        assert f'<link rel="canonical" href="{site_url}/ja/contact"' in japanese_contact.text
        assert '"@type":"ContactPage"' in japanese_contact.text

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
