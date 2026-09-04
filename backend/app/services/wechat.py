from urllib.parse import urlencode

import httpx
from fastapi import status

from ..config import settings
from ..errors import APIError

AUTHORIZE_URL = "https://open.weixin.qq.com/connect/qrconnect"
TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token"
USERINFO_URL = "https://api.weixin.qq.com/sns/userinfo"


def ensure_configured() -> None:
    if not settings.wechat_app_id or not settings.wechat_app_secret:
        raise APIError(status.HTTP_503_SERVICE_UNAVAILABLE, "wechat_not_configured")


def authorization_url(state: str) -> str:
    ensure_configured()
    query = urlencode({"appid": settings.wechat_app_id, "redirect_uri": settings.wechat_redirect_uri, "response_type": "code", "scope": "snsapi_login", "state": state})
    return f"{AUTHORIZE_URL}?{query}#wechat_redirect"


async def fetch_identity(code: str) -> dict:
    ensure_configured()
    async with httpx.AsyncClient(timeout=10) as client:
        token_response = await client.get(TOKEN_URL, params={"appid": settings.wechat_app_id, "secret": settings.wechat_app_secret, "code": code, "grant_type": "authorization_code"})
        token_response.raise_for_status()
        token = token_response.json()
        if "errcode" in token:
            raise APIError(status.HTTP_400_BAD_REQUEST, "wechat_auth_failed")
        user_response = await client.get(USERINFO_URL, params={"access_token": token["access_token"], "openid": token["openid"], "lang": "zh_CN"})
        user_response.raise_for_status()
        profile = user_response.json()
        if "errcode" in profile:
            raise APIError(status.HTTP_400_BAD_REQUEST, "wechat_profile_failed")
        return {"subject": profile["openid"], "union_id": profile.get("unionid"), "display_name": profile.get("nickname") or "微信用户"}
