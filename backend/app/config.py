from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Frontend and backend share one root environment file. / 前后端统一读取仓库根目录的环境变量文件。
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_prefix="SHANYAO_",
        env_ignore_empty=True,
        extra="ignore",
    )

    app_name: str = "Shanyao API"
    environment: str = "local"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite+aiosqlite:///./shanyao.db"
    jwt_secret: str = "local-development-secret-change-before-production"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    verification_token_minutes: int = 30
    password_reset_token_minutes: int = 30
    oauth_code_minutes: int = 5
    frontend_url: str = "http://127.0.0.1:5173"
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174"
    allowed_hosts: str = "127.0.0.1,localhost,testserver"
    expose_debug_tokens: bool = True
    email_notifications: bool = True
    email_backend: str = "console"
    email_dry_run: bool = True
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@shanyao.local"
    smtp_starttls: bool = True
    smtp_ssl: bool = False
    initial_admin_email: str = ""
    post_reward_points: int = 5
    media_backend: str = "local"
    media_local_dir: str = "uploads"
    media_public_url: str = "http://127.0.0.1:8000/media"
    max_upload_bytes: int = 52_428_800
    wechat_app_id: str = ""
    wechat_app_secret: str = ""
    wechat_redirect_uri: str = "http://127.0.0.1:8000/api/v1/auth/wechat/callback"

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse configured origins. / 解析允许的前端来源。"""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def allowed_host_list(self) -> list[str]:
        """Parse trusted HTTP Host values. / 解析可信 HTTP Host。"""
        return [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.environment not in {"local", "staging", "production"}:
            raise ValueError("SHANYAO_ENVIRONMENT must be local, staging, or production")
        if self.environment != "local":
            if len(self.jwt_secret) < 32 or self.jwt_secret.startswith("local-"):
                raise ValueError("Non-local environments require a strong SHANYAO_JWT_SECRET")
            if self.expose_debug_tokens:
                raise ValueError("Non-local environments must disable SHANYAO_EXPOSE_DEBUG_TOKENS")
            if not self.frontend_url.startswith("https://"):
                raise ValueError("Non-local SHANYAO_FRONTEND_URL must use HTTPS")
            if any(not origin.startswith("https://") or "*" in origin for origin in self.cors_origin_list):
                raise ValueError("Non-local SHANYAO_CORS_ORIGINS must use explicit HTTPS origins")
            if "*" in self.allowed_host_list or not self.allowed_host_list:
                raise ValueError("Non-local SHANYAO_ALLOWED_HOSTS must list explicit trusted hosts")
            if not self.database_url.startswith("postgresql+asyncpg://"):
                raise ValueError("Non-local environments require PostgreSQL with asyncpg")
            if self.media_backend == "local" and not self.media_public_url.startswith("https://"):
                raise ValueError("Non-local media URLs must use HTTPS")
            if self.wechat_app_id and not self.wechat_redirect_uri.startswith("https://"):
                raise ValueError("Configured WeChat callbacks must use HTTPS")
        if self.environment == "production":
            if not self.email_notifications or self.email_backend != "smtp" or not self.smtp_host:
                raise ValueError("Production requires an SMTP email backend")
            if self.email_dry_run:
                raise ValueError("Production cannot use email dry-run mode")
            if self.smtp_username and not self.smtp_password:
                raise ValueError("Production SMTP authentication requires a password")
            if self.media_backend == "local":
                raise ValueError("Production requires an object-storage media backend")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
