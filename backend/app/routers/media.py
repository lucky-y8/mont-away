"""Authenticated media upload endpoints. / 需要登录的媒体上传接口。"""

from fastapi import APIRouter, File, UploadFile, status

from ..deps import CurrentUser, DbSession
from ..models import MediaAsset
from ..schemas import MediaAssetRead
from ..services.media import public_media_url, save_upload

router = APIRouter(prefix="/media", tags=["media"])


@router.post("", response_model=MediaAssetRead, status_code=status.HTTP_201_CREATED)
async def upload_media(db: DbSession, user: CurrentUser, file: UploadFile = File()) -> MediaAssetRead:
    object_key, media_type, size = await save_upload(user.id, file)
    asset = MediaAsset(user_id=user.id, media_type=media_type, content_type=file.content_type or "application/octet-stream", object_key=object_key, size_bytes=size)
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return MediaAssetRead(id=asset.id, media_type=asset.media_type, content_type=asset.content_type, url=public_media_url(asset.object_key), size_bytes=asset.size_bytes, position=asset.position)
