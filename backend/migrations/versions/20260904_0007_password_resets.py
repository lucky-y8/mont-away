"""Create one-time password reset tokens. / 创建一次性密码重置令牌。"""

from alembic import op
import sqlalchemy as sa

revision = "20260904_0007"
down_revision = "20260904_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("password_resets", sa.Column("id", sa.String(36), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("token_hash", sa.String(64), nullable=False, unique=True), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("used_at", sa.DateTime(timezone=True), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_password_resets_user_id", "password_resets", ["user_id"])
    op.create_index("ix_password_resets_token_hash", "password_resets", ["token_hash"], unique=True)


def downgrade() -> None:
    op.drop_table("password_resets")
