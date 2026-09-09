"""Travel post and route endpoints. / 游记与路线接口。"""

import json
import math

from fastapi import APIRouter, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError

from ..deps import CurrentUser, DbSession, OptionalCurrentUser
from ..errors import APIError
from ..i18n import Locale, translate
from ..models import MediaAsset, Notification, Place, Post, PostBookmark, PostComment, PostLike, PostReport, PostVersion, RouteNode, TravelRoute, TravelTrackPoint, User, UserFollow
from ..schemas import CommentCreate, CommentRead, Coordinate, MediaAssetRead, Message, PlaceRead, PostCreate, PostRead, ReportCreate, RouteNodeRead, RouteRead, TrackPointRead
from ..services.media import public_media_url

router = APIRouter(prefix="/posts", tags=["posts"])


async def serialize_post(db: DbSession, post: Post, viewer_id: str | None = None) -> PostRead:
    """Assemble the public aggregate without leaking internal rows. / 组装公开数据，避免泄露内部字段。"""
    version = await db.get(PostVersion, post.current_version_id)
    place = await db.get(Place, post.place_id)
    author = await db.get(User, post.author_id)
    route = await db.scalar(select(TravelRoute).where(TravelRoute.post_version_id == version.id))
    nodes = list((await db.scalars(select(RouteNode).where(RouteNode.route_id == route.id).order_by(RouteNode.sequence))).all())
    track_points = list((await db.scalars(select(TravelTrackPoint).where(TravelTrackPoint.route_id == route.id).order_by(TravelTrackPoint.sequence))).all())
    like_count = int(await db.scalar(select(func.count(PostLike.id)).where(PostLike.post_id == post.id)) or 0)
    liked = bool(viewer_id and await db.scalar(select(PostLike.id).where(PostLike.post_id == post.id, PostLike.user_id == viewer_id)))
    comment_count = int(await db.scalar(select(func.count(PostComment.id)).where(PostComment.post_id == post.id, PostComment.is_deleted.is_(False))) or 0)
    bookmarked = bool(viewer_id and await db.scalar(select(PostBookmark.id).where(PostBookmark.post_id == post.id, PostBookmark.user_id == viewer_id)))
    following_author = bool(viewer_id and viewer_id != post.author_id and await db.scalar(select(UserFollow.id).where(UserFollow.follower_id == viewer_id, UserFollow.following_id == post.author_id)))
    media = list((await db.scalars(select(MediaAsset).where(MediaAsset.post_version_id == version.id, MediaAsset.route_node_id.is_(None)).order_by(MediaAsset.position))).all())
    node_reads = []
    for node in nodes:
        node_media = list((await db.scalars(select(MediaAsset).where(MediaAsset.route_node_id == node.id).order_by(MediaAsset.position))).all())
        node_reads.append(RouteNodeRead(
            id=node.id, sequence=node.sequence, name=node.name, description=node.description,
            latitude=node.latitude, longitude=node.longitude, source=node.source,
            media_ids=[item.id for item in node_media],
            media=[MediaAssetRead(id=item.id, media_type=item.media_type, content_type=item.content_type, url=public_media_url(item.object_key), size_bytes=item.size_bytes, position=item.position) for item in node_media],
        ))
    return PostRead(
        id=post.id, author_id=post.author_id, author_name=author.display_name, title=version.title, body=version.body,
        content_language=version.content_language, transport_mode=version.transport_mode, route_source=version.route_source,
        visibility_status=post.visibility_status, moderation_status=post.moderation_status, reward_status=post.reward_status,
        like_count=like_count, liked_by_me=liked, comment_count=comment_count, bookmarked_by_me=bookmarked, following_author=following_author,
        place=PlaceRead(id=place.id, name=place.name, city=place.city, country_code=place.country_code, latitude=place.latitude, longitude=place.longitude),
        route=RouteRead(id=route.id, start=Coordinate(name=route.start_name, latitude=route.start_latitude, longitude=route.start_longitude), end=Coordinate(name=route.end_name, latitude=route.end_latitude, longitude=route.end_longitude), distance_meters=route.distance_meters, nodes=node_reads, track_points=[TrackPointRead(sequence=item.sequence, latitude=item.latitude, longitude=item.longitude, accuracy_meters=item.accuracy_meters, recorded_at=item.recorded_at) for item in track_points]),
        media=[MediaAssetRead(id=item.id, media_type=item.media_type, content_type=item.content_type, url=public_media_url(item.object_key), size_bytes=item.size_bytes, position=item.position) for item in media],
        created_at=post.created_at,
    )


async def available_assets(db: DbSession, user_id: str, media_ids: list[str], reusable_version_id: str | None = None) -> list[MediaAsset]:
    """Validate ownership before attaching uploads. / 绑定上传文件前校验归属。"""
    requested_ids = list(dict.fromkeys(media_ids))
    assets = list((await db.scalars(select(MediaAsset).where(MediaAsset.id.in_(requested_ids)))).all()) if requested_ids else []
    if len(assets) != len(requested_ids) or any(asset.user_id != user_id or (asset.post_version_id is not None and asset.post_version_id != reusable_version_id) for asset in assets):
        raise APIError(status.HTTP_404_NOT_FOUND, "media_not_found")
    ordered = []
    for asset_id in requested_ids:
        asset = next(item for item in assets if item.id == asset_id)
        if asset.post_version_id is not None:
            # Copy metadata so older content versions keep their media. / 复制元数据，确保旧内容版本仍保留原媒体。
            asset = MediaAsset(user_id=user_id, media_type=asset.media_type, content_type=asset.content_type, object_key=asset.object_key, size_bytes=asset.size_bytes)
            db.add(asset)
        ordered.append(asset)
    return ordered


async def find_or_create_place(db: DbSession, payload: PostCreate) -> Place:
    place = await db.scalar(select(Place).where(Place.country_code == payload.place.country_code.upper(), Place.city == payload.place.city, Place.name == payload.place.name))
    if place is None:
        place = Place(name=payload.place.name, city=payload.place.city, country_code=payload.place.country_code.upper(), latitude=payload.place.latitude, longitude=payload.place.longitude)
        db.add(place)
        await db.flush()
    return place


async def append_version(db: DbSession, post: Post, payload: PostCreate, version_number: int, assets: dict[str, MediaAsset]) -> PostVersion:
    """Persist one immutable content snapshot. / 持久化一个不可变内容版本。"""
    version = PostVersion(post_id=post.id, version_number=version_number, title=payload.title, body=payload.body, content_language=payload.content_language, transport_mode=payload.transport_mode, route_source=payload.route_source)
    db.add(version)
    await db.flush()
    route = TravelRoute(post_version_id=version.id, start_name=payload.route.start.name, start_latitude=payload.route.start.latitude, start_longitude=payload.route.start.longitude, end_name=payload.route.end.name, end_latitude=payload.route.end.latitude, end_longitude=payload.route.end.longitude, distance_meters=payload.route.distance_meters)
    db.add(route)
    await db.flush()
    for sequence, point in enumerate(payload.route.track_points):
        db.add(TravelTrackPoint(route_id=route.id, sequence=sequence, latitude=point.latitude, longitude=point.longitude, accuracy_meters=point.accuracy_meters, recorded_at=point.recorded_at))
    for sequence, node_payload in enumerate(payload.route.nodes, start=1):
        node = RouteNode(route_id=route.id, sequence=sequence, name=node_payload.name, description=node_payload.description, latitude=node_payload.latitude, longitude=node_payload.longitude, source=node_payload.source)
        db.add(node)
        await db.flush()
        for position, asset_id in enumerate(node_payload.media_ids):
            asset = assets[asset_id]
            asset.post_version_id = version.id
            asset.route_node_id = node.id
            asset.position = position
    for position, asset_id in enumerate(payload.media_ids):
        asset = assets[asset_id]
        asset.post_version_id = version.id
        asset.route_node_id = None
        asset.position = position
    post.current_version_id = version.id
    return version


@router.post("", response_model=PostRead, status_code=status.HTTP_201_CREATED)
async def create_post(payload: PostCreate, db: DbSession, user: CurrentUser) -> PostRead:
    requested_media = [*payload.media_ids, *(asset_id for node in payload.route.nodes for asset_id in node.media_ids)]
    if len(requested_media) != len(set(requested_media)):
        raise APIError(status.HTTP_422_UNPROCESSABLE_ENTITY, "media_duplicate")
    resolved_assets = await available_assets(db, user.id, requested_media)
    assets = dict(zip(requested_media, resolved_assets))
    place = await find_or_create_place(db, payload)
    post = Post(author_id=user.id, place_id=place.id, visibility_status="public" if payload.publish else "draft", moderation_status="pending" if payload.publish else "not_submitted", reward_status="pending" if payload.publish else "not_eligible")
    db.add(post)
    await db.flush()
    await append_version(db, post, payload, 1, assets)
    await db.commit()
    await db.refresh(post)
    return await serialize_post(db, post, user.id)


@router.patch("/{post_id}", response_model=PostRead)
async def update_post(post_id: str, payload: PostCreate, db: DbSession, user: CurrentUser) -> PostRead:
    post = await db.get(Post, post_id)
    if post is None or post.author_id != user.id:
        raise APIError(status.HTTP_404_NOT_FOUND, "post_not_found")
    requested_media = [*payload.media_ids, *(asset_id for node in payload.route.nodes for asset_id in node.media_ids)]
    if len(requested_media) != len(set(requested_media)):
        raise APIError(status.HTTP_422_UNPROCESSABLE_ENTITY, "media_duplicate")
    resolved_assets = await available_assets(db, user.id, requested_media, post.current_version_id)
    assets = dict(zip(requested_media, resolved_assets))
    place = await find_or_create_place(db, payload)
    post.place_id = place.id
    next_version = int(await db.scalar(select(func.coalesce(func.max(PostVersion.version_number), 0)).where(PostVersion.post_id == post.id)) or 0) + 1
    await append_version(db, post, payload, next_version, assets)
    if post.visibility_status == "draft":
        post.visibility_status = "public" if payload.publish else "draft"
    # Removed posts stay removed until an administrator approves them. / 已下架帖子编辑后仍保持下架。
    if payload.publish:
        post.moderation_status = "pending"
        if post.reward_status != "granted":
            post.reward_status = "pending"
    elif post.visibility_status == "draft":
        post.moderation_status = "not_submitted"
        post.reward_status = "not_eligible"
    await db.commit()
    await db.refresh(post)
    return await serialize_post(db, post, user.id)


@router.get("", response_model=list[PostRead])
async def list_posts(
    db: DbSession,
    viewer: OptionalCurrentUser,
    search: str | None = Query(default=None, max_length=100),
    sort: str = Query(default="recent", pattern="^(recent|popular)$"),
    feed: str = Query(default="all", pattern="^(all|following)$"),
    limit: int = Query(default=20, ge=1, le=50),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float = Query(default=50, gt=0, le=500),
) -> list[PostRead]:
    if (latitude is None) != (longitude is None):
        raise APIError(status.HTTP_422_UNPROCESSABLE_ENTITY, "location_pair_required")
    statement = select(Post).where(Post.visibility_status == "public")
    if feed == "following":
        if viewer is None:
            raise APIError(status.HTTP_401_UNAUTHORIZED, "authentication_required")
        statement = statement.join(UserFollow, UserFollow.following_id == Post.author_id).where(UserFollow.follower_id == viewer.id)
    if search:
        term = f"%{search.strip()}%"
        statement = statement.join(PostVersion, PostVersion.id == Post.current_version_id).join(Place, Place.id == Post.place_id).where(or_(PostVersion.title.ilike(term), PostVersion.body.ilike(term), Place.name.ilike(term), Place.city.ilike(term)))
    if sort == "popular":
        # Stable like ranking with recency as tie-breaker. / 点赞榜以发布时间作为同赞数排序依据。
        statement = statement.outerjoin(PostLike, PostLike.post_id == Post.id).group_by(Post.id).order_by(func.count(PostLike.id).desc(), Post.created_at.desc())
    else:
        statement = statement.order_by(Post.created_at.desc())
    # Nearby filtering is done in Python for identical SQLite/PostgreSQL behavior at this scale. / 小规模附近筛选放在 Python，保证 SQLite 与 PostgreSQL 行为一致。
    candidate_limit = 200 if latitude is not None else limit
    posts = list((await db.scalars(statement.limit(candidate_limit))).all())
    if latitude is not None and longitude is not None:
        def distance_km(place: Place) -> float:
            earth_radius_km = 6371.0088
            lat1, lat2 = math.radians(latitude), math.radians(place.latitude)
            delta_lat = math.radians(place.latitude - latitude)
            delta_lng = math.radians(place.longitude - longitude)
            haversine = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
            return earth_radius_km * 2 * math.asin(math.sqrt(haversine))

        nearby = []
        for post in posts:
            place = await db.get(Place, post.place_id)
            distance = distance_km(place)
            if distance <= radius_km:
                nearby.append((distance, post))
        posts = [post for _, post in sorted(nearby, key=lambda item: (item[0], -item[1].created_at.timestamp()))[:limit]]
    return [await serialize_post(db, post, viewer.id if viewer else None) for post in posts]


@router.get("/mine", response_model=list[PostRead])
async def my_posts(db: DbSession, user: CurrentUser) -> list[PostRead]:
    """Include drafts and removed posts for their author. / 向作者返回草稿和已下架帖子。"""
    posts = list((await db.scalars(select(Post).where(Post.author_id == user.id).order_by(Post.updated_at.desc()))).all())
    return [await serialize_post(db, post, user.id) for post in posts]


@router.get("/{post_id}", response_model=PostRead)
async def get_post(post_id: str, db: DbSession, viewer: OptionalCurrentUser) -> PostRead:
    post = await db.get(Post, post_id)
    if post is None or post.visibility_status != "public":
        raise APIError(status.HTTP_404_NOT_FOUND, "post_not_found")
    return await serialize_post(db, post, viewer.id if viewer else None)


@router.get("/{post_id}/comments", response_model=list[CommentRead])
async def list_comments(post_id: str, db: DbSession) -> list[CommentRead]:
    post = await db.get(Post, post_id)
    if post is None or post.visibility_status != "public":
        raise APIError(status.HTTP_404_NOT_FOUND, "post_not_found")
    comments = list((await db.scalars(select(PostComment).where(PostComment.post_id == post_id, PostComment.is_deleted.is_(False)).order_by(PostComment.created_at.asc()).limit(200))).all())
    result = []
    for comment in comments:
        author = await db.get(User, comment.user_id)
        result.append(CommentRead(id=comment.id, author_id=comment.user_id, author_name=author.display_name, body=comment.body, created_at=comment.created_at))
    return result


@router.post("/{post_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
async def create_comment(post_id: str, payload: CommentCreate, db: DbSession, user: CurrentUser) -> CommentRead:
    post = await db.get(Post, post_id)
    if post is None or post.visibility_status != "public":
        raise APIError(status.HTTP_404_NOT_FOUND, "post_not_found")
    comment = PostComment(post_id=post.id, user_id=user.id, body=payload.body.strip())
    db.add(comment)
    if post.author_id != user.id:
        detail = await serialize_post(db, post)
        db.add(Notification(user_id=post.author_id, event_type="post_commented", resource_id=post.id, payload_json=json.dumps({"title": detail.title, "author": user.display_name}, ensure_ascii=False)))
    await db.commit()
    await db.refresh(comment)
    return CommentRead(id=comment.id, author_id=user.id, author_name=user.display_name, body=comment.body, created_at=comment.created_at)


@router.delete("/{post_id}/comments/{comment_id}", response_model=Message)
async def delete_comment(post_id: str, comment_id: str, db: DbSession, user: CurrentUser, locale: Locale) -> Message:
    comment = await db.get(PostComment, comment_id)
    if comment is None or comment.post_id != post_id or comment.user_id != user.id:
        raise APIError(status.HTTP_404_NOT_FOUND, "comment_not_found")
    comment.is_deleted = True
    await db.commit()
    return Message(code="comment_deleted", message=translate(locale, "comment_deleted"))


@router.post("/{post_id}/bookmarks", response_model=Message)
async def bookmark_post(post_id: str, db: DbSession, user: CurrentUser, locale: Locale) -> Message:
    post = await db.get(Post, post_id)
    if post is None or post.visibility_status != "public":
        raise APIError(status.HTTP_404_NOT_FOUND, "post_not_found")
    db.add(PostBookmark(post_id=post.id, user_id=user.id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
    return Message(code="bookmark_saved", message=translate(locale, "bookmark_saved"))


@router.delete("/{post_id}/bookmarks", response_model=Message)
async def unbookmark_post(post_id: str, db: DbSession, user: CurrentUser, locale: Locale) -> Message:
    await db.execute(delete(PostBookmark).where(PostBookmark.post_id == post_id, PostBookmark.user_id == user.id))
    await db.commit()
    return Message(code="bookmark_removed", message=translate(locale, "bookmark_removed"))


@router.post("/{post_id}/reports", response_model=Message, status_code=status.HTTP_201_CREATED)
async def report_post(post_id: str, payload: ReportCreate, db: DbSession, user: CurrentUser, locale: Locale) -> Message:
    post = await db.get(Post, post_id)
    if post is None or post.visibility_status != "public":
        raise APIError(status.HTTP_404_NOT_FOUND, "post_not_found")
    db.add(PostReport(post_id=post.id, reporter_id=user.id, category=payload.category, reason=payload.reason.strip()))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()  # One pending report per user and post. / 每位用户对同一帖子只保留一条举报。
    return Message(code="report_received", message=translate(locale, "report_received"))


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
