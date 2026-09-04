"""Email transport tests. / 邮件传输测试。"""

from app.config import settings
from app.services import email


def test_smtp_ssl_uses_implicit_tls(monkeypatch):
    calls = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            calls.update(host=host, port=port, timeout=timeout)

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def starttls(self):
            calls["starttls"] = True

        def login(self, username, password):
            calls["login"] = (username, password)

        def send_message(self, message):
            calls["message"] = message

    monkeypatch.setattr(email.smtplib, "SMTP_SSL", FakeSMTP)
    monkeypatch.setattr(settings, "smtp_host", "smtp.qq.com")
    monkeypatch.setattr(settings, "smtp_port", 465)
    monkeypatch.setattr(settings, "smtp_ssl", True)
    monkeypatch.setattr(settings, "smtp_starttls", False)
    monkeypatch.setattr(settings, "smtp_username", "sender@example.com")
    monkeypatch.setattr(settings, "smtp_password", "authorization-code")
    monkeypatch.setattr(settings, "smtp_from", "sender@example.com")

    email._send_smtp("reader@example.com", "https://example.com/verify", "zh-CN")

    assert calls["host"] == "smtp.qq.com"
    assert calls["port"] == 465
    assert "starttls" not in calls
    assert calls["login"] == ("sender@example.com", "authorization-code")
    assert calls["message"]["Subject"] == "验证你的山遥账号"
