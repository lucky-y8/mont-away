from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError

from ..config import settings
from ..deps import CurrentUser, DbSession
from ..errors import APIError
from ..i18n import Locale, translate
from ..models import EmailVerification, ExternalIdentity, OAuthLoginCode, PasswordReset, Session, User
from ..schemas import EmailCredentials, EmailRequest, Message, PasswordResetRequest, PasswordResetStartResponse, RefreshRequest, RegistrationResponse, TokenPair, UserRead, VerifyEmailRequest, WeChatExchangeRequest
from ..security import create_signed_token, decode_signed_token, hash_password, new_opaque_token, token_hash, verify_password
from ..services import wechat
from ..services.email import send_password_reset_email, send_verification_email

router = APIRouter(prefix="/auth", tags=["auth"])


def db_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def expired(value: datetime) -> bool:
    now = datetime.now(value.tzinfo) if value.tzinfo else db_now()
    return value <= now


async def issue_tokens(db: DbSession, user: User) -> TokenPair:
    refresh = new_opaque_token()
    db.add(Session(user_id=user.id, refresh_token_hash=token_hash(refresh), expires_at=db_now() + timedelta(days=settings.refresh_token_days)))
    await db.commit()
    access = create_signed_token(user.id, "access", timedelta(minutes=settings.access_token_minutes))
    return TokenPair(access_token=access, refresh_token=refresh, expires_in=settings.access_token_minutes * 60)


@router.post("/email/register", response_model=RegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: EmailCredentials, db: DbSession, locale: Locale) -> RegistrationResponse:
    email = payload.email.lower()
    if await db.scalar(select(User).where(User.email == email)):
        raise APIError(status.HTTP_409_CONFLICT, "email_exists")
    user = User(email=email, password_hash=hash_password(payload.password), display_name=email.split("@", 1)[0], is_admin=bool(settings.initial_admin_email and email == settings.initial_admin_email.lower()))
    db.add(user)
    try:
        await db.flush()
        verification_lifetime = timedelta(minutes=settings.verification_token_minutes)
        verification = create_signed_token(user.id, "verify_email", verification_lifetime)
        db.add(EmailVerification(user_id=user.id, token_hash=token_hash(verification), expires_at=db_now() + verification_lifetime))
        await send_verification_email(email, verification, locale)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise APIError(status.HTTP_409_CONFLICT, "email_exists") from exc
    await db.refresh(user)
    return RegistrationResponse(user=UserRead.model_validate(user), verification_token=verification if settings.expose_debug_tokens else None)


@router.post("/email/verify", response_model=Message)
async def verify_email(payload: VerifyEmailRequest, db: DbSession, locale: Locale) -> Message:
    user_id = decode_signed_token(payload.token, "verify_email")
    verification = await db.scalar(select(EmailVerification).where(EmailVerification.token_hash == token_hash(payload.token)))
    if verification is None or verification.used_at is not None or expired(verification.expires_at) or verification.user_id != user_id:
        raise APIError(status.HTTP_401_UNAUTHORIZED, "invalid_verification_token")
    user = await db.get(User, user_id)
    if user is None:
        raise APIError(status.HTTP_404_NOT_FOUND, "user_not_found")
    user.is_email_verified = True
    verification.used_at = db_now()
    await db.commit()
    return Message(code="email_verified", message=translate(locale, "email_verified"))


@router.post("/email/login", response_model=TokenPair)
async def login(payload: EmailCredentials, db: DbSession) -> TokenPair:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or user.password_hash is None or not verify_password(payload.password, user.password_hash):
        raise APIError(status.HTTP_401_UNAUTHORIZED, "invalid_credentials")
    if not user.is_active:
        raise APIError(status.HTTP_403_FORBIDDEN, "account_disabled")
    if not user.is_email_verified:
        raise APIError(status.HTTP_403_FORBIDDEN, "email_unverified")
    return await issue_tokens(db, user)


@router.post("/email/password/forgot", response_model=PasswordResetStartResponse)
async def forgot_password(payload: EmailRequest, db: DbSession, locale: Locale) -> PasswordResetStartResponse:
    """Return the same public response to prevent account enumeration. / 始终返回相同公开响应，防止探测注册邮箱。"""
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    reset_token = None
    if user is not None and user.password_hash is not None and user.is_active:
        await db.execute(update(PasswordReset).where(PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None)).values(used_at=db_now()))
        lifetime = timedelta(minutes=settings.password_reset_token_minutes)
        reset_token = create_signed_token(user.id, "password_reset", lifetime)
        db.add(PasswordReset(user_id=user.id, token_hash=token_hash(reset_token), expires_at=db_now() + lifetime))
        await send_password_reset_email(user.email, reset_token, locale)
        await db.commit()
    return PasswordResetStartResponse(code="password_reset_requested", message=translate(locale, "password_reset_requested"), reset_token=reset_token if settings.expose_debug_tokens else None)


@router.post("/email/password/reset", response_model=Message)
async def reset_password(payload: PasswordResetRequest, db: DbSession, locale: Locale) -> Message:
    user_id = decode_signed_token(payload.token, "password_reset")
    reset = await db.scalar(select(PasswordReset).where(PasswordReset.token_hash == token_hash(payload.token)))
    if reset is None or reset.used_at is not None or expired(reset.expires_at) or reset.user_id != user_id:
        raise APIError(status.HTTP_401_UNAUTHORIZED, "invalid_password_reset_token")
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise APIError(status.HTTP_401_UNAUTHORIZED, "user_unavailable")
    user.password_hash = hash_password(payload.password)
    reset.used_at = db_now()
    await db.execute(update(Session).where(Session.user_id == user.id, Session.revoked_at.is_(None)).values(revoked_at=db_now()))
    await db.commit()
    return Message(code="password_reset", message=translate(locale, "password_reset"))


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: DbSession) -> TokenPair:
    session = await db.scalar(select(Session).where(Session.refresh_token_hash == token_hash(payload.refresh_token)))
    if session is None or session.revoked_at is not None or expired(session.expires_at):
        raise APIError(status.HTTP_401_UNAUTHORIZED, "invalid_refresh_token")
    user = await db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise APIError(status.HTTP_401_UNAUTHORIZED, "user_unavailable")
    session.revoked_at = db_now()
    await db.flush()
    return await issue_tokens(db, user)


@router.post("/logout", response_model=Message)
async def logout(payload: RefreshRequest, db: DbSession, locale: Locale) -> Message:
    session = await db.scalar(select(Session).where(Session.refresh_token_hash == token_hash(payload.refresh_token)))
    if session and session.revoked_at is None:
        session.revoked_at = db_now()
        await db.commit()
    return Message(code="logged_out", message=translate(locale, "logged_out"))


@router.get("/me", response_model=UserRead)
async def me(user: CurrentUser) -> User:
    return user


@router.get("/wechat/start")
async def wechat_start() -> RedirectResponse:
    state_token = create_signed_token(new_opaque_token(), "wechat_state", timedelta(minutes=10))
    return RedirectResponse(wechat.authorization_url(state_token), status_code=status.HTTP_302_FOUND)


@router.get("/wechat/callback")
async def wechat_callback(db: DbSession, code: str = Query(min_length=1), state_token: str = Query(alias="state", min_length=1)) -> RedirectResponse:
    decode_signed_token(state_token, "wechat_state")
    identity_data = await wechat.fetch_identity(code)
    identity = await db.scalar(select(ExternalIdentity).where(ExternalIdentity.provider == "wechat", ExternalIdentity.subject == identity_data["subject"]))
    if identity:
        user = await db.get(User, identity.user_id)
    else:
        user = User(display_name=identity_data["display_name"])
        db.add(user)
        await db.flush()
        db.add(ExternalIdentity(user_id=user.id, provider="wechat", subject=identity_data["subject"], union_id=identity_data["union_id"]))
    exchange_code = new_opaque_token()
    db.add(OAuthLoginCode(user_id=user.id, code_hash=token_hash(exchange_code), expires_at=db_now() + timedelta(minutes=settings.oauth_code_minutes)))
    await db.commit()
    return RedirectResponse(f"{settings.frontend_url.rstrip('/')}/auth/callback?code={exchange_code}", status_code=status.HTTP_302_FOUND)


@router.post("/wechat/exchange", response_model=TokenPair)
async def wechat_exchange(payload: WeChatExchangeRequest, db: DbSession) -> TokenPair:
    login_code = await db.scalar(select(OAuthLoginCode).where(OAuthLoginCode.code_hash == token_hash(payload.code)))
    if login_code is None or login_code.used_at is not None or expired(login_code.expires_at):
        raise APIError(status.HTTP_401_UNAUTHORIZED, "invalid_login_code")
    user = await db.get(User, login_code.user_id)
    if user is None or not user.is_active:
        raise APIError(status.HTTP_401_UNAUTHORIZED, "user_unavailable")
    login_code.used_at = db_now()
    await db.flush()
    return await issue_tokens(db, user)
