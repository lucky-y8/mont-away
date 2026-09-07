"""User notifications and point ledger. / 用户通知与积分流水。"""

import json

from fastapi import APIRouter, status
from sqlalchemy import func, select

from ..deps import CurrentUser, DbSession
from ..i18n import Locale, translate
from ..errors import APIError
from ..models import GiftRedemption, Notification, PointLedger, Post, PostBookmark
from ..schemas import Message, NotificationRead, PointAccountRead, PointEntryRead, PostRead, RedemptionRead
from .gifts import cancel_and_refund, serialize_redemption
from .posts import serialize_post

router = APIRouter(prefix="/account", tags=["account"])


@router.get("/points", response_model=PointAccountRead)
async def points(db: DbSession, user: CurrentUser) -> PointAccountRead:
    entries = list((await db.scalars(select(PointLedger).where(PointLedger.user_id == user.id).order_by(PointLedger.created_at.desc()))).all())
    balance = int(await db.scalar(select(func.coalesce(func.sum(PointLedger.amount), 0)).where(PointLedger.user_id == user.id)) or 0)
    return PointAccountRead(balance=balance, entries=[PointEntryRead.model_validate(entry) for entry in entries])


@router.get("/notifications", response_model=list[NotificationRead])
async def notifications(db: DbSession, user: CurrentUser, locale: Locale) -> list[NotificationRead]:
    rows = list((await db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(100))).all())
    result = []
    for row in rows:
        payload = json.loads(row.payload_json)
        template = translate(locale, f"notification_{row.event_type}")
        result.append(NotificationRead(id=row.id, event_type=row.event_type, resource_id=row.resource_id, payload=payload, message=template.format(**payload), read_at=row.read_at, created_at=row.created_at))
    return result


@router.get("/bookmarks", response_model=list[PostRead])
async def bookmarks(db: DbSession, user: CurrentUser) -> list[PostRead]:
    """Return visible saved posts only. / 仅返回仍然公开的收藏帖子。"""
    posts = list((await db.scalars(select(Post).join(PostBookmark, PostBookmark.post_id == Post.id).where(PostBookmark.user_id == user.id, Post.visibility_status == "public").order_by(PostBookmark.created_at.desc()))).all())
    return [await serialize_post(db, post, user.id) for post in posts]


@router.get("/redemptions", response_model=list[RedemptionRead])
async def redemptions(db: DbSession, user: CurrentUser, locale: Locale) -> list[RedemptionRead]:
    rows = list((await db.scalars(select(GiftRedemption).where(GiftRedemption.user_id == user.id).order_by(GiftRedemption.created_at.desc()))).all())
    return [await serialize_redemption(db, item, locale) for item in rows]


@router.post("/redemptions/{redemption_id}/cancel", response_model=Message)
async def cancel_redemption(redemption_id: str, db: DbSession, user: CurrentUser, locale: Locale) -> Message:
    redemption = await db.scalar(select(GiftRedemption).where(GiftRedemption.id == redemption_id).with_for_update())
    if redemption is None or redemption.user_id != user.id:
        raise APIError(status.HTTP_404_NOT_FOUND, "redemption_not_found")
    await cancel_and_refund(db, redemption)
    await db.commit()
    return Message(code="redemption_cancelled", message=translate(locale, "redemption_cancelled"))
