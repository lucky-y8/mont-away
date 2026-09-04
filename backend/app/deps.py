from typing import Annotated

from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .errors import APIError
from .models import User
from .security import decode_signed_token
from .services.account_status import clear_expired_ban, raise_if_banned

bearer = HTTPBearer(auto_error=False)
DbSession = Annotated[AsyncSession, Depends(get_db)]


async def current_user(db: DbSession, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> User:
    if credentials is None:
        raise APIError(status.HTTP_401_UNAUTHORIZED, "authentication_required")
    user_id = decode_signed_token(credentials.credentials, "access")
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise APIError(status.HTTP_401_UNAUTHORIZED, "user_unavailable")
    if clear_expired_ban(user):
        await db.commit()
    raise_if_banned(user)
    return user


CurrentUser = Annotated[User, Depends(current_user)]


async def optional_current_user(db: DbSession, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> User | None:
    """Resolve a viewer when supplied. / 请求携带令牌时解析当前访问者。"""
    if credentials is None:
        return None
    user_id = decode_signed_token(credentials.credentials, "access")
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise APIError(status.HTTP_401_UNAUTHORIZED, "user_unavailable")
    if clear_expired_ban(user):
        await db.commit()
    raise_if_banned(user)
    return user


OptionalCurrentUser = Annotated[User | None, Depends(optional_current_user)]


async def admin_user(user: CurrentUser) -> User:
    """Require an administrator. / 要求管理员权限。"""
    if not user.is_admin:
        raise APIError(status.HTTP_403_FORBIDDEN, "admin_required")
    return user


AdminUser = Annotated[User, Depends(admin_user)]
