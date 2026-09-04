"""Email delivery adapter. / 邮件发送适配层。"""

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from ..config import settings
from ..errors import APIError
from fastapi import status

logger = logging.getLogger(__name__)


def _send_smtp(recipient: str, verification_url: str) -> None:
    message = EmailMessage()
    message["Subject"] = "Verify your Shanyao account / 验证你的山遥账号"
    message["From"] = settings.smtp_from
    message["To"] = recipient
    message.set_content(f"Verify your account / 验证账号:\n{verification_url}")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
        if settings.smtp_starttls:
            client.starttls()
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)


async def send_verification_email(recipient: str, token: str) -> None:
    """Send through SMTP, or log locally. / 生产走 SMTP，本地输出验证链接。"""
    url = f"{settings.frontend_url.rstrip('/')}/auth/verify?token={token}"
    if settings.email_backend == "console":
        logger.warning("LOCAL EMAIL for %s: %s", recipient, url)
        return
    try:
        await asyncio.to_thread(_send_smtp, recipient, url)
    except (OSError, smtplib.SMTPException) as exc:
        raise APIError(status.HTTP_503_SERVICE_UNAVAILABLE, "email_delivery_failed") from exc
