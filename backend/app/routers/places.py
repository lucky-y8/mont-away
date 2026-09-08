"""Public place pages. / 公开景点聚合页接口。"""

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select

from ..deps import DbSession, OptionalCurrentUser
from ..errors import APIError
from ..models import Place, Post
from ..schemas import PlaceDetailRead, PlaceRead
from .posts import serialize_post

router = APIRouter(prefix="/places", tags=["places"])


@router.get("/{place_id}", response_model=PlaceDetailRead)
async def place_detail(
    place_id: str,
    db: DbSession,
    viewer: OptionalCurrentUser,
    limit: int = Query(default=20, ge=1, le=50),
) -> PlaceDetailRead:
    """Aggregate visible stories without exposing drafts or removed posts. / 聚合公开游记，不暴露草稿或已下架内容。"""
    place = await db.get(Place, place_id)
    if place is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "place_not_found")
    statement = (
        select(Post)
        .where(Post.place_id == place.id, Post.visibility_status == "public")
        .order_by(Post.created_at.desc())
        .limit(limit)
    )
    posts = list((await db.scalars(statement)).all())
    count_statement = select(func.count(Post.id)).where(
        Post.place_id == place.id,
        Post.visibility_status == "public",
    )
    post_count = int(await db.scalar(count_statement) or 0)
    place_read = PlaceRead(
        id=place.id,
        name=place.name,
        city=place.city,
        country_code=place.country_code,
        latitude=place.latitude,
        longitude=place.longitude,
    )
    return PlaceDetailRead(
        place=place_read,
        post_count=post_count,
        posts=[await serialize_post(db, post, viewer.id if viewer else None) for post in posts],
    )
