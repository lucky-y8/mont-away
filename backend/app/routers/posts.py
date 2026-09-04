"""Travel post and route endpoints. / 游记与路线接口。"""

from fastapi import APIRouter, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError

from ..deps import CurrentUser, DbSession, OptionalCurrentUser
from ..errors import APIError
from ..models import Place, Post, PostLike, PostVersion, RouteNode, TravelRoute, User
from ..schemas import Coordinate, PlaceRead, PostCreate, PostRead, RouteNodeRead, RouteRead

router = APIRouter(prefix="/posts", tags=["posts"])


async def serialize_post(db: DbSession, post: Post, viewer_id: str | None = None) -> PostRead:
    """Assemble the public aggregate without leaking internal rows. / 组装公开数据，避免泄露内部字段。"""
    version = await db.get(PostVersion, post.current_version_id)
    place = await db.get(Place, post.place_id)
    author = await db.get(User, post.author_id)
    route = await db.scalar(select(TravelRoute).where(TravelRoute.post_version_id == version.id))
    nodes = list((await db.scalars(select(RouteNode).where(RouteNode.route_id == route.id).order_by(RouteNode.sequence))).all())
    like_count = int(await db.scalar(select(func.count(PostLike.id)).where(PostLike.post_id == post.id)) or 0)
    liked = bool(viewer_id and await db.scalar(select(PostLike.id).where(PostLike.post_id == post.id, PostLike.user_id == viewer_id)))
    return PostRead(
        id=post.id, author_id=post.author_id, author_name=author.display_name, title=version.title, body=version.body,
        content_language=version.content_language, transport_mode=version.transport_mode, route_source=version.route_source,
        visibility_status=post.visibility_status, moderation_status=post.moderation_status, reward_status=post.reward_status,
        like_count=like_count, liked_by_me=liked,
        place=PlaceRead(id=place.id, name=place.name, city=place.city, country_code=place.country_code, latitude=place.latitude, longitude=place.longitude),
        route=RouteRead(id=route.id, start=Coordinate(name=route.start_name, latitude=route.start_latitude, longitude=route.start_longitude), end=Coordinate(name=route.end_name, latitude=route.end_latitude, longitude=route.end_longitude), distance_meters=route.distance_meters, nodes=[RouteNodeRead(id=n.id, sequence=n.sequence, name=n.name, description=n.description, latitude=n.latitude, longitude=n.longitude, source=n.source) for n in nodes]),
        created_at=post.created_at,
    )


@router.post("", response_model=PostRead, status_code=status.HTTP_201_CREATED)
async def create_post(payload: PostCreate, db: DbSession, user: CurrentUser) -> PostRead:
    place = await db.scalar(select(Place).where(Place.country_code == payload.place.country_code.upper(), Place.city == payload.place.city, Place.name == payload.place.name))
    if place is None:
        place = Place(name=payload.place.name, city=payload.place.city, country_code=payload.place.country_code.upper(), latitude=payload.place.latitude, longitude=payload.place.longitude)
        db.add(place)
        await db.flush()
    post = Post(author_id=user.id, place_id=place.id, visibility_status="public", moderation_status="pending", reward_status="pending")
    db.add(post)
    await db.flush()
    version = PostVersion(post_id=post.id, version_number=1, title=payload.title, body=payload.body, content_language=payload.content_language, transport_mode=payload.transport_mode, route_source=payload.route_source)
    db.add(version)
    await db.flush()
    route = TravelRoute(post_version_id=version.id, start_name=payload.route.start.name, start_latitude=payload.route.start.latitude, start_longitude=payload.route.start.longitude, end_name=payload.route.end.name, end_latitude=payload.route.end.latitude, end_longitude=payload.route.end.longitude, distance_meters=payload.route.distance_meters)
    db.add(route)
    await db.flush()
    for sequence, node in enumerate(payload.route.nodes, start=1):
        db.add(RouteNode(route_id=route.id, sequence=sequence, name=node.name, description=node.description, latitude=node.latitude, longitude=node.longitude, source=node.source))
    post.current_version_id = version.id
    await db.commit()
    await db.refresh(post)
    return await serialize_post(db, post, user.id)


@router.get("", response_model=list[PostRead])
async def list_posts(db: DbSession, viewer: OptionalCurrentUser, search: str | None = Query(default=None, max_length=100), sort: str = Query(default="recent", pattern="^(recent|popular)$"), limit: int = Query(default=20, ge=1, le=50)) -> list[PostRead]:
    statement = select(Post).where(Post.visibility_status == "public")
    if search:
        term = f"%{search.strip()}%"
        statement = statement.join(PostVersion, PostVersion.id == Post.current_version_id).join(Place, Place.id == Post.place_id).where(or_(PostVersion.title.ilike(term), PostVersion.body.ilike(term), Place.name.ilike(term), Place.city.ilike(term)))
    if sort == "popular":
        # Stable like ranking with recency as tie-breaker. / 点赞榜以发布时间作为同赞数排序依据。
        statement = statement.outerjoin(PostLike, PostLike.post_id == Post.id).group_by(Post.id).order_by(func.count(PostLike.id).desc(), Post.created_at.desc())
    else:
        statement = statement.order_by(Post.created_at.desc())
    posts = list((await db.scalars(statement.limit(limit))).all())
    return [await serialize_post(db, post, viewer.id if viewer else None) for post in posts]


@router.get("/{post_id}", response_model=PostRead)
async def get_post(post_id: str, db: DbSession, viewer: OptionalCurrentUser) -> PostRead:
    post = await db.get(Post, post_id)
    if post is None or post.visibility_status != "public":
        raise APIError(status.HTTP_404_NOT_FOUND, "post_not_found")
    return await serialize_post(db, post, viewer.id if viewer else None)


@router.post("/{post_id}/likes", response_model=PostRead)
async def like_post(post_id: str, db: DbSession, user: CurrentUser) -> PostRead:
    viewer_id = user.id
    post = await db.get(Post, post_id)
    if post is None or post.visibility_status != "public":
        raise APIError(status.HTTP_404_NOT_FOUND, "post_not_found")
    db.add(PostLike(post_id=post.id, user_id=viewer_id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()  # Idempotent like. / 重复点赞按幂等成功处理。
        post = await db.get(Post, post_id)
    return await serialize_post(db, post, viewer_id)


@router.delete("/{post_id}/likes", response_model=PostRead)
async def unlike_post(post_id: str, db: DbSession, user: CurrentUser) -> PostRead:
    post = await db.get(Post, post_id)
    if post is None or post.visibility_status != "public":
        raise APIError(status.HTTP_404_NOT_FOUND, "post_not_found")
    await db.execute(delete(PostLike).where(PostLike.post_id == post.id, PostLike.user_id == user.id))
    await db.commit()
    return await serialize_post(db, post, user.id)
