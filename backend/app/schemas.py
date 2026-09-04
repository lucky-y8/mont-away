from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EmailCredentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr | None
    display_name: str
    is_email_verified: bool
    created_at: datetime


class RegistrationResponse(BaseModel):
    user: UserRead
    verification_token: str | None = None


class VerifyEmailRequest(BaseModel):
    token: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class Message(BaseModel):
    message: str


class WeChatExchangeRequest(BaseModel):
    code: str
