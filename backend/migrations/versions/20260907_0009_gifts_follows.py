"""Add gift redemption and following. / 添加礼品兑换与关注关系。"""

from alembic import op
import sqlalchemy as sa

revision = "20260907_0009"
down_revision = "20260904_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_follows",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("follower_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("following_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("follower_id", "following_id", name="uq_user_follow_pair"),
        sa.CheckConstraint("follower_id <> following_id", name="ck_user_follow_not_self"),
    )
    op.create_index("ix_user_follows_follower_id", "user_follows", ["follower_id"])
    op.create_index("ix_user_follows_following_id", "user_follows", ["following_id"])
    op.create_table(
        "gifts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("name_zh", sa.String(120), nullable=False),
        sa.Column("name_en", sa.String(120), nullable=False),
        sa.Column("name_ja", sa.String(120), nullable=False),
        sa.Column("description_zh", sa.Text(), nullable=False, server_default=""),
        sa.Column("description_en", sa.Text(), nullable=False, server_default=""),
        sa.Column("description_ja", sa.Text(), nullable=False, server_default=""),
        sa.Column("point_cost", sa.Integer(), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("image_url", sa.String(1000), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("slug"),
        sa.CheckConstraint("point_cost > 0", name="ck_gift_positive_cost"),
        sa.CheckConstraint("stock >= 0", name="ck_gift_nonnegative_stock"),
    )
    op.create_index("ix_gifts_slug", "gifts", ["slug"], unique=True)
    op.create_index("ix_gifts_is_active", "gifts", ["is_active"])
    op.create_table(
        "gift_redemptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("gift_id", sa.String(36), sa.ForeignKey("gifts.id"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("points_cost", sa.Integer(), nullable=False),
        sa.Column("recipient_name", sa.String(120), nullable=False),
        sa.Column("contact", sa.String(200), nullable=False),
        sa.Column("shipping_address", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("tracking_number", sa.String(160), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_redemption_positive_quantity"),
        sa.CheckConstraint("points_cost > 0", name="ck_redemption_positive_cost"),
    )
    op.create_index("ix_gift_redemptions_user_id", "gift_redemptions", ["user_id"])
    op.create_index("ix_gift_redemptions_gift_id", "gift_redemptions", ["gift_id"])
    op.create_index("ix_gift_redemptions_status", "gift_redemptions", ["status"])


def downgrade() -> None:
    op.drop_table("gift_redemptions")
    op.drop_table("gifts")
    op.drop_table("user_follows")
