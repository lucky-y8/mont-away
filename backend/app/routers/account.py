"""User notifications and point ledger. / 用户通知与积分流水。"""

import json

from fastapi import APIRouter
from sqlalchemy import func, select

from ..deps import CurrentUser, DbSession
from ..i18n import Locale, translate
from ..models import Notification, PointLedger
from ..schemas import NotificationRead, PointAccountRead, PointEntryRead

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
