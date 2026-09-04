"""Email delivery adapter. / 邮件发送适配层。"""

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from ..config import settings
from ..errors import APIError
from fastapi import status

logger = logging.getLogger(__name__)

EMAIL_COPY = {
    "zh-CN": ("验证你的山遥账号", "点击下面的链接验证账号："),
    "en": ("Verify your Shanyao account", "Open the link below to verify your account:"),
    "ja": ("山遥アカウントを確認", "下のリンクを開いてアカウントを確認してください："),
}
PASSWORD_RESET_COPY = {
    "zh-CN": ("重置你的山遥密码", "点击下面的链接重置密码："),
    "en": ("Reset your Shanyao password", "Open the link below to reset your password:"),
    "ja": ("山遥のパスワードを再設定", "下のリンクを開いてパスワードを再設定してください："),
}


def _send_smtp(recipient: str, action_url: str, locale: str, purpose: str = "verify") -> None:
    copy = PASSWORD_RESET_COPY if purpose == "password_reset" else EMAIL_COPY
    subject, introduction = copy.get(locale, copy["zh-CN"])
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from
    message["To"] = recipient
    message.set_content(f"{introduction}\n\n{action_url}")
    smtp_client = smtplib.SMTP_SSL if settings.smtp_ssl else smtplib.SMTP
    with smtp_client(settings.smtp_host, settings.smtp_port, timeout=10) as client:
        if settings.smtp_starttls and not settings.smtp_ssl:
            client.starttls()
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)


async def _send_action_email(recipient: str, url: str, locale: str, purpose: str) -> None:
    """Send through SMTP, or log in dry-run. / 生产走 SMTP，演练模式只记录链接。"""
    if not settings.email_notifications:
        return
    if settings.email_backend == "console" or settings.email_dry_run:
        logger.warning("DRY-RUN %s EMAIL for %s [%s]: %s", purpose, recipient, locale, url)
        return
    try:
        await asyncio.to_thread(_send_smtp, recipient, url, locale, purpose)
    except (OSError, smtplib.SMTPException) as exc:
        raise APIError(status.HTTP_503_SERVICE_UNAVAILABLE, "email_delivery_failed") from exc


async def send_verification_email(recipient: str, token: str, locale: str) -> None:
    url = f"{settings.frontend_url.rstrip('/')}/auth/verify?token={token}"
    await _send_action_email(recipient, url, locale, "verify")


async def send_password_reset_email(recipient: str, token: str, locale: str) -> None:
    url = f"{settings.frontend_url.rstrip('/')}/auth/reset-password?token={token}"
    await _send_action_email(recipient, url, locale, "password_reset")
