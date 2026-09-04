"""Account availability rules. / 账号可用状态规则。"""

from datetime import datetime, timezone

from fastapi import status

from ..errors import APIError
from ..models import User


def db_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def clear_expired_ban(user: User) -> bool:
    """Lazily clear a temporary ban after expiry. / 限时封禁到期后惰性解封。"""
    if user.is_banned and user.banned_until is not None and user.banned_until <= db_now():
        user.is_banned = False
        user.banned_until = None
        user.ban_reason = ""
        return True
    return False


def raise_if_banned(user: User) -> None:
    """Expose the administrator reason without exposing internal records. / 向用户显示封禁原因，但不泄露内部记录。"""
    if not user.is_banned:
        return
    context = {"reason": user.ban_reason}
    if user.banned_until is not None:
        until = user.banned_until if user.banned_until.tzinfo else user.banned_until.replace(tzinfo=timezone.utc)
        context["until"] = until.isoformat(timespec="minutes")
        raise APIError(status.HTTP_403_FORBIDDEN, "account_banned_until", context)
    raise APIError(status.HTTP_403_FORBIDDEN, "account_banned", context)
