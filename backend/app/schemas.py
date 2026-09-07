from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


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


class AdminUserRead(BaseModel):
    id: str
    email: EmailStr | None
    display_name: str
    is_admin: bool
    is_banned: bool
    banned_until: datetime | None
    ban_reason: str
    created_at: datetime


class UserBanRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)
    duration_hours: int | None = Field(default=None, ge=1, le=24 * 365)

    @field_validator("reason")
    @classmethod
    def meaningful_reason(cls, value: str) -> str:
        """Reject empty moderation reasons. / 拒绝空白的封禁原因。"""
        if not value.strip():
            raise ValueError("ban reason cannot be blank")
        return value.strip()


class RegistrationResponse(BaseModel):
    user: UserRead
    verification_token: str | None = None


class VerifyEmailRequest(BaseModel):
    token: str


class EmailRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


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


class PasswordResetStartResponse(Message):
    reset_token: str | None = None


class WeChatExchangeRequest(BaseModel):
    code: str


class Coordinate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class RouteNodeCreate(Coordinate):
    description: str = Field(default="", max_length=1000)
    source: str = Field(default="manual", pattern="^(gps|manual|edited)$")
    media_ids: list[str] = Field(default_factory=list, max_length=10)


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
    publish: bool = True
    media_ids: list[str] = Field(default_factory=list, max_length=20)
    place: PlaceCreate
    route: RouteCreate


class MediaAssetRead(BaseModel):
    id: str
    media_type: str
    content_type: str
    url: str
    size_bytes: int
    position: int


class RouteNodeRead(RouteNodeCreate):
    id: str
    sequence: int
    media: list[MediaAssetRead] = Field(default_factory=list)


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
    comment_count: int
    bookmarked_by_me: bool
    following_author: bool
    place: PlaceRead
    route: RouteRead
    media: list[MediaAssetRead] = Field(default_factory=list)
    created_at: datetime


class ModerationRequest(BaseModel):
    reason: str = Field(default="", max_length=2000)


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)

    @field_validator("body")
    @classmethod
    def meaningful_body(cls, value: str) -> str:
        """Reject whitespace-only comments. / 拒绝只有空白字符的评论。"""
        if not value.strip():
            raise ValueError("comment body cannot be blank")
        return value.strip()


class CommentRead(BaseModel):
    id: str
    author_id: str
    author_name: str
    body: str
    created_at: datetime


class ReportCreate(BaseModel):
    category: str = Field(default="other", pattern="^(spam|unsafe|copyright|harassment|other)$")
    reason: str = Field(min_length=1, max_length=2000)

    @field_validator("reason")
    @classmethod
    def meaningful_reason(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("report reason cannot be blank")
        return value.strip()


class ReportRead(BaseModel):
    id: str
    post_id: str
    reporter_id: str
    category: str
    reason: str
    status: str
    resolution: str
    created_at: datetime


class ReportResolution(BaseModel):
    resolution: str = Field(min_length=1, max_length=2000)


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


class FollowStateRead(BaseModel):
    user_id: str
    following: bool
    follower_count: int


class GiftRead(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    point_cost: int
    stock: int
    image_url: str | None
    is_active: bool


class AdminGiftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    slug: str
    name_zh: str
    name_en: str
    name_ja: str
    description_zh: str
    description_en: str
    description_ja: str
    point_cost: int
    stock: int
    image_url: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class GiftCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name_zh: str = Field(min_length=1, max_length=120)
    name_en: str = Field(min_length=1, max_length=120)
    name_ja: str = Field(min_length=1, max_length=120)
    description_zh: str = Field(default="", max_length=4000)
    description_en: str = Field(default="", max_length=4000)
    description_ja: str = Field(default="", max_length=4000)
    point_cost: int = Field(ge=1, le=10_000_000)
    stock: int = Field(ge=0, le=10_000_000)
    image_url: str | None = Field(default=None, max_length=1000)
    is_active: bool = True


class GiftUpdate(BaseModel):
    name_zh: str | None = Field(default=None, min_length=1, max_length=120)
    name_en: str | None = Field(default=None, min_length=1, max_length=120)
    name_ja: str | None = Field(default=None, min_length=1, max_length=120)
    description_zh: str | None = Field(default=None, max_length=4000)
    description_en: str | None = Field(default=None, max_length=4000)
    description_ja: str | None = Field(default=None, max_length=4000)
    point_cost: int | None = Field(default=None, ge=1, le=10_000_000)
    stock: int | None = Field(default=None, ge=0, le=10_000_000)
    image_url: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None


class RedemptionCreate(BaseModel):
    quantity: int = Field(default=1, ge=1, le=10)
    recipient_name: str = Field(min_length=1, max_length=120)
    contact: str = Field(min_length=1, max_length=200)
    shipping_address: str = Field(min_length=1, max_length=2000)


class RedemptionRead(BaseModel):
    id: str
    user_id: str
    gift: GiftRead
    quantity: int
    points_cost: int
    recipient_name: str
    contact: str
    shipping_address: str
    status: str
    tracking_number: str | None
    created_at: datetime
    updated_at: datetime


class RedemptionShipRequest(BaseModel):
    tracking_number: str = Field(min_length=1, max_length=160)
