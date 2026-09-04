from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Shanyao API"
    environment: str = "local"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite+aiosqlite:///./shanyao.db"
    jwt_secret: str = "local-development-secret-change-before-production"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    verification_token_minutes: int = 30
    oauth_code_minutes: int = 5
    frontend_url: str = "http://127.0.0.1:5173"
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174"
    expose_debug_tokens: bool = True
    email_backend: str = "console"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@shanyao.local"
    smtp_starttls: bool = True
    initial_admin_email: str = ""
    post_reward_points: int | None = None
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

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.environment == "production":
            if len(self.jwt_secret) < 32 or self.jwt_secret.startswith("local-"):
                raise ValueError("JWT_SECRET must be a strong production secret")
            if self.expose_debug_tokens:
                raise ValueError("EXPOSE_DEBUG_TOKENS must be false in production")
            if self.email_backend != "smtp" or not self.smtp_host:
                raise ValueError("Production requires an SMTP email backend")
            if self.media_backend == "local":
                raise ValueError("Production requires an object-storage media backend")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
