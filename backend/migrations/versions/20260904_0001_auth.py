"""Create authentication tables. / 创建认证数据表。"""

from alembic import op
import sqlalchemy as sa

revision = "20260904_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("users", sa.Column("id", sa.String(36), primary_key=True), sa.Column("email", sa.String(320), nullable=True), sa.Column("password_hash", sa.String(255), nullable=True), sa.Column("display_name", sa.String(80), nullable=False), sa.Column("is_email_verified", sa.Boolean(), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table("external_identities", sa.Column("id", sa.String(36), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("provider", sa.String(30), nullable=False), sa.Column("subject", sa.String(128), nullable=False), sa.Column("union_id", sa.String(128), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("provider", "subject", name="uq_identity_provider_subject"))
    op.create_index("ix_external_identities_user_id", "external_identities", ["user_id"])
    op.create_index("ix_external_identities_union_id", "external_identities", ["union_id"])
    op.create_table("sessions", sa.Column("id", sa.String(36), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("refresh_token_hash", sa.String(64), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_refresh_token_hash", "sessions", ["refresh_token_hash"], unique=True)
    op.create_table("oauth_login_codes", sa.Column("id", sa.String(36), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("code_hash", sa.String(64), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("used_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_oauth_login_codes_user_id", "oauth_login_codes", ["user_id"])
    op.create_index("ix_oauth_login_codes_code_hash", "oauth_login_codes", ["code_hash"], unique=True)


def downgrade() -> None:
    op.drop_table("oauth_login_codes")
    op.drop_table("sessions")
    op.drop_table("external_identities")
    op.drop_table("users")
