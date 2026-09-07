"""User relationship endpoints. / 用户关注关系接口。"""

import json

from fastapi import APIRouter, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from ..deps import CurrentUser, DbSession
from ..errors import APIError
from ..models import Notification, User, UserFollow
from ..schemas import FollowStateRead

router = APIRouter(prefix="/users", tags=["users"])


async def follow_state(db: DbSession, target_id: str, viewer_id: str) -> FollowStateRead:
    following = bool(await db.scalar(select(UserFollow.id).where(UserFollow.follower_id == viewer_id, UserFollow.following_id == target_id)))
    follower_count = int(await db.scalar(select(func.count(UserFollow.id)).where(UserFollow.following_id == target_id)) or 0)
    return FollowStateRead(user_id=target_id, following=following, follower_count=follower_count)


@router.post("/{user_id}/follow", response_model=FollowStateRead)
async def follow_user(user_id: str, db: DbSession, user: CurrentUser) -> FollowStateRead:
    if user_id == user.id:
        raise APIError(status.HTTP_409_CONFLICT, "cannot_follow_self")
    target = await db.get(User, user_id)
    if target is None or not target.is_active:
        raise APIError(status.HTTP_404_NOT_FOUND, "user_not_found")
    target_id = target.id
    viewer_id = user.id
    db.add(UserFollow(follower_id=viewer_id, following_id=target_id))
    try:
        await db.flush()
        db.add(Notification(user_id=target_id, event_type="account_followed", resource_id=viewer_id, payload_json=json.dumps({"author": user.display_name}, ensure_ascii=False)))
        await db.commit()
    except IntegrityError:
        await db.rollback()  # Duplicate follows are idempotent. / 重复关注按幂等成功处理。
    return await follow_state(db, target_id, viewer_id)


@router.delete("/{user_id}/follow", response_model=FollowStateRead)
async def unfollow_user(user_id: str, db: DbSession, user: CurrentUser) -> FollowStateRead:
    target = await db.get(User, user_id)
    if target is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "user_not_found")
    await db.execute(delete(UserFollow).where(UserFollow.follower_id == user.id, UserFollow.following_id == user_id))
    await db.commit()
    return await follow_state(db, target.id, user.id)
