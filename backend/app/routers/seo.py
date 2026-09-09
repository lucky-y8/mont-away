"""Search-engine HTML shells and discovery documents. / 搜索引擎 HTML 外壳与抓取文件。"""

import html
import json
import re
from pathlib import Path
from xml.sax.saxutils import escape

from fastapi import APIRouter
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from sqlalchemy import select

from ..config import PROJECT_ROOT, settings
from ..deps import DbSession
from ..models import MediaAsset, Place, Post, PostVersion, User
from ..services.media import public_media_url


router = APIRouter(tags=["seo"])
DIST_INDEX = Path(PROJECT_ROOT) / "dist" / "index.html"

LANGUAGES = {
    "zh-CN": {"prefix": "", "site_name": "山遥", "og_locale": "zh_CN"},
    "en": {"prefix": "/en", "site_name": "Mont Away", "og_locale": "en_US"},
    "ja": {"prefix": "/ja", "site_name": "山遥", "og_locale": "ja_JP"},
}

CORE_COPY = {
    "zh-CN": {
        "home": ("山遥｜发现小众旅行地点、路线与真实地图游记", "山遥是小众旅行地点与路线分享社区。发现真实用户发布的景点、徒步与骑行路线、地图节点、图片和视频，收藏下一次出发。"),
        "map": ("地图发现｜附近小众景点与旅行路线｜山遥", "在山遥地图中发现附近的小众景点、徒步路线、骑行路线与真实旅行记录。"),
        "ranking": ("热门旅行地点与游记榜单｜山遥", "查看山遥社区近期最受欢迎的小众旅行地点、路线和地图游记。"),
    },
    "en": {
        "home": ("Mont Away | Discover Quiet Places, Travel Routes and Map Stories", "Discover lesser-known places, walking and cycling routes, map-based stories, photos and videos shared by real travelers."),
        "map": ("Explore Travel Places and Routes on the Map | Mont Away", "Discover nearby places, walking and cycling routes, and authentic travel stories on the Mont Away map."),
        "ranking": ("Popular Travel Places and Map Stories | Mont Away", "Explore the travel places, routes and map stories most loved by the Mont Away community."),
    },
    "ja": {
        "home": ("山遥｜静かな旅先・ルート・地図旅行記を見つけよう", "知られざる旅先、徒歩・自転車ルート、地図旅行記、写真や動画を共有する旅行コミュニティです。"),
        "map": ("地図で旅先とルートを探す｜山遥", "地図から近くの静かな旅先、徒歩・自転車ルート、旅行記を見つけられます。"),
        "ranking": ("人気の旅先と旅行記｜山遥", "山遥コミュニティで人気の旅先、ルート、地図旅行記を紹介します。"),
    },
}


def site_url() -> str:
    """Use the configured public frontend origin. / 使用已配置的前端公网域名。"""
    return settings.frontend_url.rstrip("/")


def localized_path(path: str, locale: str) -> str:
    prefix = LANGUAGES[locale]["prefix"]
    return f"{prefix}/" if path == "/" else f"{prefix}{path}"


def compact(value: str, maximum: int = 160) -> str:
    text = " ".join((value or "").split())
    return text if len(text) <= maximum else f"{text[:maximum - 1].rstrip()}…"


def absolute_media_url(value: str | None) -> str:
    if not value:
        return f"{site_url()}/og-cover.png"
    if value.startswith(("https://", "http://")):
        return value
    return f"{site_url()}/{value.lstrip('/')}"


def alternates(path: str) -> str:
    links = [
        ("zh-CN", f"{site_url()}{localized_path(path, 'zh-CN')}"),
        ("en", f"{site_url()}{localized_path(path, 'en')}"),
        ("ja", f"{site_url()}{localized_path(path, 'ja')}"),
        ("x-default", f"{site_url()}{localized_path(path, 'zh-CN')}"),
    ]
    return "\n".join(f'<link rel="alternate" hreflang="{language}" href="{html.escape(url, quote=True)}" />' for language, url in links)


def render_shell(
    *,
    locale: str,
    path: str,
    title: str,
    description: str,
    image: str | None = None,
    page_type: str = "website",
    indexable: bool = True,
    structured_data: dict | None = None,
    status_code: int = 200,
) -> HTMLResponse:
    """Insert route-specific metadata before the SPA boots. / 在 SPA 启动前注入路由级元数据。"""
    canonical = f"{site_url()}{localized_path(path, locale)}"
    image_url = absolute_media_url(image)
    site_name = LANGUAGES[locale]["site_name"]
    robots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" if indexable else "noindex,nofollow"
    data = structured_data or {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title,
        "description": description,
        "url": canonical,
        "inLanguage": locale,
    }
    json_ld = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    metadata = f"""
    <title>{html.escape(title)}</title>
    <meta name="description" content="{html.escape(description, quote=True)}" />
    <meta name="robots" content="{robots}" />
    <link rel="canonical" href="{html.escape(canonical, quote=True)}" />
    {alternates(path)}
    <meta property="og:title" content="{html.escape(title, quote=True)}" />
    <meta property="og:description" content="{html.escape(description, quote=True)}" />
    <meta property="og:type" content="{page_type}" />
    <meta property="og:url" content="{html.escape(canonical, quote=True)}" />
    <meta property="og:site_name" content="{html.escape(site_name, quote=True)}" />
    <meta property="og:locale" content="{LANGUAGES[locale]['og_locale']}" />
    <meta property="og:image" content="{html.escape(image_url, quote=True)}" />
    <meta property="og:image:alt" content="{html.escape(title, quote=True)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{html.escape(title, quote=True)}" />
    <meta name="twitter:description" content="{html.escape(description, quote=True)}" />
    <meta name="twitter:image" content="{html.escape(image_url, quote=True)}" />
    <script id="shanyao-structured-data" type="application/ld+json">{json_ld}</script>
    """

    if DIST_INDEX.exists():
        document = DIST_INDEX.read_text(encoding="utf-8")
    else:
        document = '<!doctype html><html><head></head><body><div id="root"></div></body></html>'

    # Remove default metadata from the built shell before inserting the route-specific version. / 去掉构建壳中的默认元数据，避免重复信号。
    patterns = [
        r"<title>.*?</title>",
        r'<meta\s+(?:name|property)="(?:description|keywords|robots|author|og:[^"]+|twitter:[^"]+)"[^>]*>\s*',
        r'<link\s+rel="(?:canonical|alternate)"[^>]*>\s*',
        r'<script\s+id="shanyao-structured-data"[^>]*>.*?</script>\s*',
    ]
    for pattern in patterns:
        document = re.sub(pattern, "", document, flags=re.IGNORECASE | re.DOTALL)
    document = document.replace("<head>", f'<head>\n    {metadata}', 1)
    document = re.sub(r'<html\s+lang="[^"]*"', f'<html lang="{locale}"', document, count=1, flags=re.IGNORECASE)
    return HTMLResponse(document, status_code=status_code, headers={"Cache-Control": "public, max-age=300"})


async def post_metadata(db: DbSession, post_id: str, locale: str) -> HTMLResponse:
    post = await db.get(Post, post_id)
    if post is None or post.visibility_status != "public" or not post.current_version_id:
        title = "游记不存在｜山遥" if locale == "zh-CN" else "Travel story not found | Mont Away"
        return render_shell(locale=locale, path=f"/posts/{post_id}", title=title, description=title, indexable=False, status_code=404)

    version = await db.get(PostVersion, post.current_version_id)
    place = await db.get(Place, post.place_id)
    author = await db.get(User, post.author_id)
    media = await db.scalar(
        select(MediaAsset)
        .where(MediaAsset.post_version_id == version.id, MediaAsset.route_node_id.is_(None), MediaAsset.media_type == "image")
        .order_by(MediaAsset.position)
    )
    if locale == "en":
        title = compact(f"{version.title} | {place.name} Travel Story | Mont Away", 70)
        description = compact(f"{version.body} — Explore the route and stops around {place.name}, {place.city}.")
    elif locale == "ja":
        title = compact(f"{version.title}｜{place.name}の旅行記｜山遥", 70)
        description = compact(f"{version.body} — {place.name}（{place.city}）のルートと立ち寄り地点。")
    else:
        title = compact(f"{version.title}｜{place.name}旅行游记与路线｜山遥", 70)
        description = compact(f"{version.body} — 查看{place.name}的真实路线与沿途节点。")
    image = public_media_url(media.object_key) if media else None
    path = f"/posts/{post.id}"
    structured = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": version.title,
        "description": description,
        "image": [absolute_media_url(image)],
        "datePublished": post.created_at.isoformat(),
        "dateModified": post.updated_at.isoformat(),
        "inLanguage": version.content_language,
        "author": {"@type": "Person", "name": author.display_name},
        "publisher": {"@type": "Organization", "name": LANGUAGES[locale]["site_name"], "url": site_url()},
        "mainEntityOfPage": f"{site_url()}{localized_path(path, locale)}",
        "contentLocation": {
            "@type": "Place",
            "name": place.name,
            "address": place.city,
            "geo": {"@type": "GeoCoordinates", "latitude": place.latitude, "longitude": place.longitude},
        },
    }
    return render_shell(
        locale=locale,
        path=path,
        title=title,
        description=description,
        image=image,
        page_type="article",
        indexable=post.moderation_status == "approved",
        structured_data=structured,
    )


async def place_metadata(db: DbSession, place_id: str, locale: str) -> HTMLResponse:
    place = await db.get(Place, place_id)
    if place is None:
        title = "地点不存在｜山遥" if locale == "zh-CN" else "Place not found | Mont Away"
        return render_shell(locale=locale, path=f"/places/{place_id}", title=title, description=title, indexable=False, status_code=404)
    if locale == "en":
        title = compact(f"{place.name} | {place.city} Travel Guide and Routes | Mont Away", 70)
        description = compact(f"Explore authentic travel stories, photos, routes and trip ideas for {place.name} in {place.city}.")
    elif locale == "ja":
        title = compact(f"{place.name}｜{place.city}の旅行ガイドとルート｜山遥", 70)
        description = compact(f"{place.name}（{place.city}）の旅行記、写真、ルート、旅のアイデアを見つけましょう。")
    else:
        title = compact(f"{place.name}｜{place.city}旅行攻略与游玩路线｜山遥", 70)
        description = compact(f"查看{place.name}的真实旅行记录、图片、路线节点与游玩灵感，发现{place.city}值得收藏的小众地点。")
    path = f"/places/{place.id}"
    structured = {
        "@context": "https://schema.org",
        "@type": "TouristAttraction",
        "name": place.name,
        "description": description,
        "url": f"{site_url()}{localized_path(path, locale)}",
        "address": place.city,
        "geo": {"@type": "GeoCoordinates", "latitude": place.latitude, "longitude": place.longitude},
    }
    return render_shell(locale=locale, path=path, title=title, description=description, structured_data=structured)


@router.get("/posts/{post_id}", response_class=HTMLResponse, include_in_schema=False)
async def chinese_post_page(post_id: str, db: DbSession) -> HTMLResponse:
    return await post_metadata(db, post_id, "zh-CN")


@router.get("/posts/{post_id}/route", response_class=HTMLResponse, include_in_schema=False)
async def chinese_route_page(post_id: str, db: DbSession) -> HTMLResponse:
    return await post_metadata(db, post_id, "zh-CN")


@router.get("/en/posts/{post_id}", response_class=HTMLResponse, include_in_schema=False)
async def english_post_page(post_id: str, db: DbSession) -> HTMLResponse:
    return await post_metadata(db, post_id, "en")


@router.get("/en/posts/{post_id}/route", response_class=HTMLResponse, include_in_schema=False)
async def english_route_page(post_id: str, db: DbSession) -> HTMLResponse:
    return await post_metadata(db, post_id, "en")


@router.get("/ja/posts/{post_id}", response_class=HTMLResponse, include_in_schema=False)
async def japanese_post_page(post_id: str, db: DbSession) -> HTMLResponse:
    return await post_metadata(db, post_id, "ja")


@router.get("/ja/posts/{post_id}/route", response_class=HTMLResponse, include_in_schema=False)
async def japanese_route_page(post_id: str, db: DbSession) -> HTMLResponse:
    return await post_metadata(db, post_id, "ja")


@router.get("/places/{place_id}", response_class=HTMLResponse, include_in_schema=False)
async def chinese_place_page(place_id: str, db: DbSession) -> HTMLResponse:
    return await place_metadata(db, place_id, "zh-CN")


@router.get("/en/places/{place_id}", response_class=HTMLResponse, include_in_schema=False)
async def english_place_page(place_id: str, db: DbSession) -> HTMLResponse:
    return await place_metadata(db, place_id, "en")


@router.get("/ja/places/{place_id}", response_class=HTMLResponse, include_in_schema=False)
async def japanese_place_page(place_id: str, db: DbSession) -> HTMLResponse:
    return await place_metadata(db, place_id, "ja")


@router.get("/sitemap.xml", include_in_schema=False)
async def sitemap(db: DbSession) -> Response:
    posts = list((await db.scalars(
        select(Post)
        .where(Post.visibility_status == "public", Post.moderation_status == "approved")
        .order_by(Post.updated_at.desc())
    )).all())
    places: dict[str, Place] = {}
    for post in posts:
        place = await db.get(Place, post.place_id)
        if place:
            places[place.id] = place

    rows: list[tuple[str, str, str, str]] = [
        ("/", "daily", "1.0", ""),
        ("/map", "daily", "0.8", ""),
        ("/ranking", "daily", "0.7", ""),
    ]
    rows.extend((f"/posts/{post.id}", "weekly", "0.8", post.updated_at.date().isoformat()) for post in posts)
    rows.extend((f"/places/{place.id}", "weekly", "0.7", place.created_at.date().isoformat()) for place in places.values())

    entries = []
    for path, frequency, priority, last_modified in rows:
        for locale in ("zh-CN", "en", "ja"):
            url = f"{site_url()}{localized_path(path, locale)}"
            lastmod = f"<lastmod>{last_modified}</lastmod>" if last_modified else ""
            entries.append(
                f"<url><loc>{escape(url)}</loc>{lastmod}<changefreq>{frequency}</changefreq><priority>{priority}</priority>"
                f'<xhtml:link rel="alternate" hreflang="zh-CN" href="{escape(site_url() + localized_path(path, "zh-CN"))}" />'
                f'<xhtml:link rel="alternate" hreflang="en" href="{escape(site_url() + localized_path(path, "en"))}" />'
                f'<xhtml:link rel="alternate" hreflang="ja" href="{escape(site_url() + localized_path(path, "ja"))}" />'
                f'<xhtml:link rel="alternate" hreflang="x-default" href="{escape(site_url() + localized_path(path, "zh-CN"))}" />'
                "</url>"
            )
    document = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(entries) + "\n</urlset>"
    return Response(document, media_type="application/xml", headers={"Cache-Control": "public, max-age=900"})


@router.get("/robots.txt", response_class=PlainTextResponse, include_in_schema=False)
async def robots() -> PlainTextResponse:
    document = f"""User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin
Disallow: /profile
Disallow: /publish
Disallow: /messages
Disallow: /gifts
Disallow: /auth/
Disallow: /en/admin
Disallow: /en/profile
Disallow: /en/publish
Disallow: /en/messages
Disallow: /en/gifts
Disallow: /en/auth/
Disallow: /ja/admin
Disallow: /ja/profile
Disallow: /ja/publish
Disallow: /ja/messages
Disallow: /ja/gifts
Disallow: /ja/auth/

Sitemap: {site_url()}/sitemap.xml
"""
    return PlainTextResponse(document)


@router.get("/llms.txt", response_class=PlainTextResponse, include_in_schema=False)
async def llms() -> PlainTextResponse:
    document = f"""# 山遥 · Mont Away

> 山遥是发现和分享小众旅行地点、徒步与骑行路线、地图游记、图片和视频的社区。
> Mont Away is a community for discovering and sharing lesser-known travel places, routes and map stories.

- Chinese: {site_url()}/
- English: {site_url()}/en/
- Map discovery: {site_url()}/map
- Popular stories: {site_url()}/ranking
- Sitemap: {site_url()}/sitemap.xml

Public posts are traveler-authored. Private account, administration, messaging and publishing pages should not be indexed.
"""
    return PlainTextResponse(document)


def core_shell(locale: str, path: str) -> HTMLResponse:
    normalized = f"/{path.strip('/')}" if path.strip("/") else "/"
    page = "map" if normalized == "/map" else "ranking" if normalized == "/ranking" else "home"
    title, description = CORE_COPY[locale][page]
    indexable = normalized in {"/", "/map", "/ranking"}
    return render_shell(locale=locale, path=normalized if indexable else "/", title=title, description=description, indexable=indexable)


@router.get("/en", response_class=HTMLResponse, include_in_schema=False)
@router.get("/en/", response_class=HTMLResponse, include_in_schema=False)
async def english_home() -> HTMLResponse:
    return core_shell("en", "/")


@router.get("/ja", response_class=HTMLResponse, include_in_schema=False)
@router.get("/ja/", response_class=HTMLResponse, include_in_schema=False)
async def japanese_home() -> HTMLResponse:
    return core_shell("ja", "/")


@router.get("/en/{path:path}", response_class=HTMLResponse, include_in_schema=False)
async def english_shell(path: str) -> HTMLResponse:
    return core_shell("en", path)


@router.get("/ja/{path:path}", response_class=HTMLResponse, include_in_schema=False)
async def japanese_shell(path: str) -> HTMLResponse:
    return core_shell("ja", path)
