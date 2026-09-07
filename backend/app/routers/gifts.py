"""Gift catalog and point redemption endpoints. / 礼品目录与积分兑换接口。"""

from fastapi import APIRouter, status
from sqlalchemy import func, select

from ..deps import CurrentUser, DbSession
from ..errors import APIError
from ..i18n import Locale
from ..models import Gift, GiftRedemption, PointLedger, User
from ..schemas import GiftRead, RedemptionCreate, RedemptionRead

router = APIRouter(prefix="/gifts", tags=["gifts"])


def serialize_gift(gift: Gift, locale: str) -> GiftRead:
    """Choose catalog copy for the request language. / 按请求语言选择礼品文案。"""
    suffix = {"zh-CN": "zh", "en": "en", "ja": "ja"}.get(locale, "zh")
    return GiftRead(
        id=gift.id, slug=gift.slug, name=getattr(gift, f"name_{suffix}"),
        description=getattr(gift, f"description_{suffix}"), point_cost=gift.point_cost,
        stock=gift.stock, image_url=gift.image_url, is_active=gift.is_active,
    )


async def serialize_redemption(db: DbSession, redemption: GiftRedemption, locale: str) -> RedemptionRead:
    gift = await db.get(Gift, redemption.gift_id)
    return RedemptionRead(
        id=redemption.id, user_id=redemption.user_id, gift=serialize_gift(gift, locale),
        quantity=redemption.quantity, points_cost=redemption.points_cost,
        recipient_name=redemption.recipient_name, contact=redemption.contact,
        shipping_address=redemption.shipping_address, status=redemption.status,
        tracking_number=redemption.tracking_number, created_at=redemption.created_at,
        updated_at=redemption.updated_at,
    )


async def cancel_and_refund(db: DbSession, redemption: GiftRedemption) -> None:
    """Restore points and stock exactly once. / 仅执行一次积分与库存返还。"""
    if redemption.status != "pending_fulfillment":
        raise APIError(status.HTTP_409_CONFLICT, "redemption_not_cancellable")
    gift = await db.scalar(select(Gift).where(Gift.id == redemption.gift_id).with_for_update())
    gift.stock += redemption.quantity
    redemption.status = "cancelled"
    db.add(PointLedger(user_id=redemption.user_id, amount=redemption.points_cost, entry_type="gift_refund", reference_type="gift_redemption", reference_id=redemption.id))


@router.get("", response_model=list[GiftRead])
async def list_gifts(db: DbSession, locale: Locale) -> list[GiftRead]:
    gifts = list((await db.scalars(select(Gift).where(Gift.is_active.is_(True)).order_by(Gift.created_at.desc()))).all())
    return [serialize_gift(gift, locale) for gift in gifts]


@router.post("/{gift_id}/redeem", response_model=RedemptionRead, status_code=status.HTTP_201_CREATED)
async def redeem_gift(gift_id: str, payload: RedemptionCreate, db: DbSession, user: CurrentUser, locale: Locale) -> RedemptionRead:
    # Lock the account as well, so two different gifts cannot overspend one balance. / 同时锁定账号，避免并发兑换不同礼品导致积分透支。
    await db.scalar(select(User).where(User.id == user.id).with_for_update())
    # PostgreSQL locks this catalog row; SQLite remains suitable for local development. / PostgreSQL 会锁定礼品行，SQLite 用于本地开发。
    gift = await db.scalar(select(Gift).where(Gift.id == gift_id).with_for_update())
    if gift is None or not gift.is_active:
        raise APIError(status.HTTP_404_NOT_FOUND, "gift_not_found")
    if gift.stock < payload.quantity:
        raise APIError(status.HTTP_409_CONFLICT, "gift_out_of_stock")
    total_cost = gift.point_cost * payload.quantity
    balance = int(await db.scalar(select(func.coalesce(func.sum(PointLedger.amount), 0)).where(PointLedger.user_id == user.id)) or 0)
    if balance < total_cost:
        raise APIError(status.HTTP_409_CONFLICT, "insufficient_points")
    redemption = GiftRedemption(
        user_id=user.id, gift_id=gift.id, quantity=payload.quantity, points_cost=total_cost,
        recipient_name=payload.recipient_name.strip(), contact=payload.contact.strip(),
        shipping_address=payload.shipping_address.strip(),
    )
    gift.stock -= payload.quantity
    db.add(redemption)
    await db.flush()
    db.add(PointLedger(user_id=user.id, amount=-total_cost, entry_type="gift_redemption", reference_type="gift_redemption", reference_id=redemption.id))
    await db.commit()
    await db.refresh(redemption)
    return await serialize_redemption(db, redemption, locale)
