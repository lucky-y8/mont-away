"""Create one-time email verification tokens. / 创建一次性邮箱验证令牌。"""

from alembic import op
import sqlalchemy as sa

revision = "20260904_0006"
down_revision = "20260904_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("email_verifications", sa.Column("id", sa.String(36), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("token_hash", sa.String(64), nullable=False, unique=True), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("used_at", sa.DateTime(timezone=True), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_email_verifications_user_id", "email_verifications", ["user_id"])
    op.create_index("ix_email_verifications_token_hash", "email_verifications", ["token_hash"], unique=True)


def downgrade() -> None:
    op.drop_table("email_verifications")
