"""Moderation endpoints. / 内容审核接口。"""

import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query, status
from sqlalchemy import or_, select, update

from ..config import settings
from ..deps import AdminUser, DbSession
from ..errors import APIError
from ..i18n import Locale, translate
from ..models import AccountModerationAction, Gift, GiftRedemption, ModerationAction, Notification, PointLedger, Post, PostReport, Session, User
from ..schemas import AdminGiftRead, AdminUserRead, GiftCreate, GiftUpdate, Message, ModerationRequest, PostRead, RedemptionRead, RedemptionShipRequest, RemovalRequest, ReportRead, ReportResolution, UserBanRequest
from ..services.account_status import clear_expired_ban
from .gifts import cancel_and_refund, serialize_redemption
from .posts import serialize_post

router = APIRouter(prefix="/admin", tags=["admin"])


def admin_user_read(user: User) -> AdminUserRead:
    banned_until = user.banned_until if user.banned_until is None or user.banned_until.tzinfo else user.banned_until.replace(tzinfo=timezone.utc)
    return AdminUserRead(id=user.id, email=user.email, display_name=user.display_name, is_admin=user.is_admin, is_banned=user.is_banned, banned_until=banned_until, ban_reason=user.ban_reason, created_at=user.created_at)


@router.get("/users", response_model=list[AdminUserRead])
async def user_queue(db: DbSession, _: AdminUser, search: str | None = Query(default=None, max_length=100), limit: int = Query(default=100, ge=1, le=200)) -> list[AdminUserRead]:
    statement = select(User)
    if search and search.strip():
        term = f"%{search.strip()}%"
        statement = statement.where(or_(User.email.ilike(term), User.display_name.ilike(term)))
    users = list((await db.scalars(statement.order_by(User.created_at.desc()).limit(limit))).all())
    changed = False
    for user in users:
        changed = clear_expired_ban(user) or changed
    if changed:
        await db.commit()
    return [admin_user_read(user) for user in users]


@router.post("/users/{user_id}/ban", response_model=Message)
async def ban_user(user_id: str, payload: UserBanRequest, db: DbSession, admin: AdminUser, locale: Locale) -> Message:
    """Ban permanently by default, or until a configured hour limit. / 默认永久封禁，也可按小时限时封禁。"""
    user = await db.get(User, user_id)
    if user is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "user_not_found")
    if user.is_admin:
        raise APIError(status.HTTP_409_CONFLICT, "cannot_ban_admin")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    banned_until = now + timedelta(hours=payload.duration_hours) if payload.duration_hours else None
    user.is_banned = True
    user.banned_until = banned_until
    user.ban_reason = payload.reason
    await db.execute(update(Session).where(Session.user_id == user.id, Session.revoked_at.is_(None)).values(revoked_at=now))
    db.add(AccountModerationAction(user_id=user.id, admin_id=admin.id, action="ban", reason=payload.reason, banned_until=banned_until))
    db.add(Notification(user_id=user.id, event_type="account_banned", payload_json=json.dumps({"reason": payload.reason, "until": banned_until.replace(tzinfo=timezone.utc).isoformat() if banned_until else None}, ensure_ascii=False)))
    await db.commit()
    return Message(code="user_banned", message=translate(locale, "user_banned"))


@router.post("/users/{user_id}/unban", response_model=Message)
async def unban_user(user_id: str, db: DbSession, admin: AdminUser, locale: Locale) -> Message:
    user = await db.get(User, user_id)
    if user is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "user_not_found")
    user.is_banned = False
    user.banned_until = None
    user.ban_reason = ""
    db.add(AccountModerationAction(user_id=user.id, admin_id=admin.id, action="unban"))
    db.add(Notification(user_id=user.id, event_type="account_unbanned", payload_json="{}"))
    await db.commit()
    return Message(code="user_unbanned", message=translate(locale, "user_unbanned"))


@router.get("/reports", response_model=list[ReportRead])
async def report_queue(db: DbSession, _: AdminUser, report_status: str | None = Query(default="pending")) -> list[ReportRead]:
    statement = select(PostReport)
    if report_status:
        statement = statement.where(PostReport.status == report_status)
    reports = list((await db.scalars(statement.order_by(PostReport.created_at.asc()).limit(100))).all())
    return [ReportRead(id=item.id, post_id=item.post_id, reporter_id=item.reporter_id, category=item.category, reason=item.reason, status=item.status, resolution=item.resolution, created_at=item.created_at) for item in reports]


@router.post("/reports/{report_id}/resolve", response_model=Message)
async def resolve_report(report_id: str, payload: ReportResolution, db: DbSession, admin: AdminUser, locale: Locale) -> Message:
    report = await db.get(PostReport, report_id)
    if report is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "report_not_found")
    report.status = "resolved"
    report.resolution = payload.resolution.strip()
    report.resolved_by = admin.id
    report.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return Message(code="report_resolved", message=translate(locale, "report_resolved"))


@router.get("/posts", response_model=list[PostRead])
async def moderation_queue(db: DbSession, _: AdminUser, moderation_status: str | None = Query(default="pending"), limit: int = Query(default=50, ge=1, le=100)) -> list[PostRead]:
    statement = select(Post)
    if moderation_status:
        statement = statement.where(Post.moderation_status == moderation_status)
    posts = list((await db.scalars(statement.order_by(Post.updated_at.asc()).limit(limit))).all())
    return [await serialize_post(db, post) for post in posts]


@router.post("/posts/{post_id}/approve", response_model=Message)
async def approve_post(post_id: str, payload: ModerationRequest, db: DbSession, admin: AdminUser, locale: Locale) -> Message:
    post = await db.get(Post, post_id)
    if post is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "post_not_found")
    detail = await serialize_post(db, post)
    post.visibility_status = "public"
    post.moderation_status = "approved"
    existing_reward = await db.scalar(select(PointLedger).where(PointLedger.reference_type == "post", PointLedger.reference_id == post.id, PointLedger.entry_type == "post_reward"))
    if existing_reward:
        post.reward_status = "granted"
    elif settings.post_reward_points and settings.post_reward_points > 0:
        db.add(PointLedger(user_id=post.author_id, amount=settings.post_reward_points, entry_type="post_reward", reference_type="post", reference_id=post.id))
        post.reward_status = "granted"
    else:
        post.reward_status = "pending_configuration"
    db.add(ModerationAction(post_id=post.id, post_version_id=post.current_version_id, admin_id=admin.id, action="approve", reason=payload.reason))
    db.add(Notification(user_id=post.author_id, event_type="post_approved", resource_id=post.id, payload_json=json.dumps({"title": detail.title}, ensure_ascii=False)))
    await db.commit()
    return Message(code="post_approved", message=translate(locale, "post_approved"))


@router.post("/posts/{post_id}/remove", response_model=Message)
async def remove_post(post_id: str, payload: RemovalRequest, db: DbSession, admin: AdminUser, locale: Locale) -> Message:
    post = await db.get(Post, post_id)
    if post is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "post_not_found")
    detail = await serialize_post(db, post)
    post.visibility_status = "removed"
    post.moderation_status = "rejected"
    db.add(ModerationAction(post_id=post.id, post_version_id=post.current_version_id, admin_id=admin.id, action="remove", reason=payload.reason))
    db.add(Notification(user_id=post.author_id, event_type="post_removed", resource_id=post.id, payload_json=json.dumps({"title": detail.title, "reason": payload.reason}, ensure_ascii=False)))
    await db.commit()
    return Message(code="post_removed", message=translate(locale, "post_removed"))


@router.get("/gifts", response_model=list[AdminGiftRead])
async def gift_catalog(db: DbSession, _: AdminUser) -> list[AdminGiftRead]:
    gifts = list((await db.scalars(select(Gift).order_by(Gift.created_at.desc()))).all())
    return [AdminGiftRead.model_validate(gift) for gift in gifts]


@router.post("/gifts", response_model=AdminGiftRead, status_code=status.HTTP_201_CREATED)
async def create_gift(payload: GiftCreate, db: DbSession, _: AdminUser) -> AdminGiftRead:
    if await db.scalar(select(Gift.id).where(Gift.slug == payload.slug)):
        raise APIError(status.HTTP_409_CONFLICT, "gift_slug_exists")
    gift = Gift(**payload.model_dump())
    db.add(gift)
    await db.commit()
    await db.refresh(gift)
    return AdminGiftRead.model_validate(gift)


@router.patch("/gifts/{gift_id}", response_model=AdminGiftRead)
async def update_gift(gift_id: str, payload: GiftUpdate, db: DbSession, _: AdminUser) -> AdminGiftRead:
    gift = await db.get(Gift, gift_id)
    if gift is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "gift_not_found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(gift, field, value)
    await db.commit()
    await db.refresh(gift)
    return AdminGiftRead.model_validate(gift)


@router.get("/redemptions", response_model=list[RedemptionRead])
async def redemption_queue(db: DbSession, _: AdminUser, locale: Locale, redemption_status: str | None = Query(default="pending_fulfillment")) -> list[RedemptionRead]:
    statement = select(GiftRedemption)
    if redemption_status:
        statement = statement.where(GiftRedemption.status == redemption_status)
    rows = list((await db.scalars(statement.order_by(GiftRedemption.created_at.asc()).limit(200))).all())
    return [await serialize_redemption(db, item, locale) for item in rows]


@router.post("/redemptions/{redemption_id}/ship", response_model=Message)
async def ship_redemption(redemption_id: str, payload: RedemptionShipRequest, db: DbSession, _: AdminUser, locale: Locale) -> Message:
    redemption = await db.scalar(select(GiftRedemption).where(GiftRedemption.id == redemption_id).with_for_update())
    if redemption is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "redemption_not_found")
    if redemption.status != "pending_fulfillment":
        raise APIError(status.HTTP_409_CONFLICT, "redemption_not_fulfillable")
    redemption.status = "shipped"
    redemption.tracking_number = payload.tracking_number.strip()
    db.add(Notification(user_id=redemption.user_id, event_type="gift_shipped", resource_id=redemption.id, payload_json=json.dumps({"tracking": redemption.tracking_number}, ensure_ascii=False)))
    await db.commit()
    return Message(code="redemption_shipped", message=translate(locale, "redemption_shipped"))


@router.post("/redemptions/{redemption_id}/cancel", response_model=Message)
async def admin_cancel_redemption(redemption_id: str, db: DbSession, _: AdminUser, locale: Locale) -> Message:
    redemption = await db.scalar(select(GiftRedemption).where(GiftRedemption.id == redemption_id).with_for_update())
    if redemption is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "redemption_not_found")
    await cancel_and_refund(db, redemption)
    db.add(Notification(user_id=redemption.user_id, event_type="gift_cancelled", resource_id=redemption.id, payload_json="{}"))
    await db.commit()
    return Message(code="redemption_cancelled", message=translate(locale, "redemption_cancelled"))
