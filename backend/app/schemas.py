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
    is_admin: bool
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
    code: str
    message: str


class WeChatExchangeRequest(BaseModel):
    code: str


class Coordinate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class RouteNodeCreate(Coordinate):
    description: str = Field(default="", max_length=1000)
    source: str = Field(default="manual", pattern="^(gps|manual|edited)$")


class RouteCreate(BaseModel):
    start: Coordinate
    end: Coordinate
    distance_meters: int | None = Field(default=None, ge=0)
    nodes: list[RouteNodeCreate] = Field(default_factory=list, max_length=100)


class PlaceCreate(Coordinate):
    city: str = Field(min_length=1, max_length=120)
    country_code: str = Field(default="CN", min_length=2, max_length=2)


class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=20_000)
    content_language: str = Field(default="zh-CN", max_length=16)
    transport_mode: str | None = Field(default=None, max_length=30)
    route_source: str = Field(default="manual", pattern="^(gps|manual|mixed)$")
    place: PlaceCreate
    route: RouteCreate


class RouteNodeRead(RouteNodeCreate):
    id: str
    sequence: int


class RouteRead(BaseModel):
    id: str
    start: Coordinate
    end: Coordinate
    distance_meters: int | None
    nodes: list[RouteNodeRead]


class PlaceRead(PlaceCreate):
    id: str


class PostRead(BaseModel):
    id: str
    author_id: str
    author_name: str
    title: str
    body: str
    content_language: str
    transport_mode: str | None
    route_source: str
    visibility_status: str
    moderation_status: str
    reward_status: str
    like_count: int
    liked_by_me: bool
    place: PlaceRead
    route: RouteRead
    created_at: datetime


class ModerationRequest(BaseModel):
    reason: str = Field(default="", max_length=2000)


class RemovalRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


class PointEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    amount: int
    entry_type: str
    reference_type: str
    reference_id: str
    created_at: datetime


class PointAccountRead(BaseModel):
    balance: int
    entries: list[PointEntryRead]


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    event_type: str
    resource_id: str | None
    payload: dict
    message: str
    read_at: datetime | None
    created_at: datetime
