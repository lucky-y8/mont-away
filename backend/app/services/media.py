"""Media storage adapter. / 媒体文件存储适配层。"""

import uuid
from pathlib import Path

from fastapi import UploadFile, status

from ..config import settings
from ..errors import APIError

ALLOWED_TYPES = {
    "image/jpeg": ("image", ".jpg"),
    "image/png": ("image", ".png"),
    "image/webp": ("image", ".webp"),
    "video/mp4": ("video", ".mp4"),
    "video/quicktime": ("video", ".mov"),
}


async def save_upload(user_id: str, upload: UploadFile) -> tuple[str, str, int]:
    """Stream to local development storage with a hard size limit. / 流式写入本地开发存储，并严格限制大小。"""
    if settings.media_backend != "local":
        raise APIError(status.HTTP_503_SERVICE_UNAVAILABLE, "media_backend_not_configured")
    media = ALLOWED_TYPES.get(upload.content_type or "")
    if media is None:
        raise APIError(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "media_invalid_type")
    media_type, extension = media
    object_key = f"{user_id}/{uuid.uuid4().hex}{extension}"
    target = Path(settings.media_local_dir).resolve() / object_key
    target.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    try:
        with target.open("wb") as stream:
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise APIError(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "media_too_large")
                stream.write(chunk)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()
    return object_key, media_type, size


def public_media_url(object_key: str) -> str:
    return f"{settings.media_public_url.rstrip('/')}/{object_key.replace(chr(92), '/')}"
