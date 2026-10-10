"""Serve two independent web entries and preserve legacy travel URLs. / 双入口与旧地址兼容。"""
from pathlib import Path
from xml.sax.saxutils import escape
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from .config import PROJECT_ROOT
from .routers import seo

router = APIRouter(include_in_schema=False)
DIST = PROJECT_ROOT / 'dist'
LEGACY = {'en', 'ja', 'posts', 'places', 'map', 'ranking', 'contact', 'profile', 'publish', 'messages', 'gifts', 'search', 'admin', 'auth'}

@router.get('/robots.txt')
async def robots():
    return await seo.robots()

@router.get('/sitemap.xml')
async def sitemap_index():
    origin = escape(seo.site_url())
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>{origin}/study-sitemap.xml</loc></sitemap><sitemap><loc>{origin}/shanyao/sitemap.xml</loc></sitemap></sitemapindex>', media_type='application/xml')

@router.get('/study-sitemap.xml')
async def study_sitemap():
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{escape(seo.site_url())}/</loc></url></urlset>', media_type='application/xml')

@router.get('/llms.txt')
async def llms():
    return await seo.llms()

@router.api_route('/{path:path}', methods=['GET', 'HEAD'])
async def frontend(path: str, request: Request):
    if path == 'shanyao' or path.split('/')[0] in LEGACY:
        target = '/shanyao/' if path == 'shanyao' else '/shanyao/' + path
        if request.url.query: target += '?' + request.url.query
        return RedirectResponse(target, status_code=308)
    # Only expose built public files, never the repository or runtime database. / 仅提供公开构建文件。
    candidate = (DIST / (path or 'index.html')).resolve()
    if candidate.is_relative_to(DIST.resolve()) and candidate.is_file() and not any(part.startswith('.') for part in Path(path).parts):
        return FileResponse(candidate, headers={'Cache-Control': 'no-cache' if candidate.suffix == '.html' else 'public, max-age=3600'})
    if path.startswith('study-assets/'):
        public = (PROJECT_ROOT / 'study-room/public').resolve()
        asset = (public / path).resolve()
        if asset.is_relative_to(public) and asset.is_file(): return FileResponse(asset)
        raise HTTPException(404)
    if path.startswith('shanyao/') and not Path(path).suffix:
        return seo.core_shell('zh-CN', path.removeprefix('shanyao/'))
    raise HTTPException(404)
