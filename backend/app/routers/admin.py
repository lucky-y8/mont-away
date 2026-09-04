"""Moderation endpoints. / 内容审核接口。"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from ..config import settings
from ..deps import AdminUser, DbSession
from ..errors import APIError
from ..i18n import Locale, translate
from ..models import ModerationAction, Notification, PointLedger, Post, PostReport
from ..schemas import Message, ModerationRequest, PostRead, RemovalRequest, ReportRead, ReportResolution
from .posts import serialize_post

router = APIRouter(prefix="/admin", tags=["admin"])


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
