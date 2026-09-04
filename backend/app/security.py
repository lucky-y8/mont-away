import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import status
from pwdlib import PasswordHash

from .config import settings
from .errors import APIError

password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def create_signed_token(subject: str, purpose: str, lifetime: timedelta) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": subject, "purpose": purpose, "iat": now, "exp": now + lifetime}, settings.jwt_secret, algorithm="HS256")


def decode_signed_token(token: str, purpose: str) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise APIError(status.HTTP_401_UNAUTHORIZED, "invalid_token") from exc
    if payload.get("purpose") != purpose or not payload.get("sub"):
        raise APIError(status.HTTP_401_UNAUTHORIZED, "invalid_token_purpose")
    return str(payload["sub"])


def new_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
