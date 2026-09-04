"""Add account ban state and audit history. / 添加账号封禁状态与审计记录。"""

from alembic import op
import sqlalchemy as sa

revision = "20260904_0008"
down_revision = "20260904_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_banned", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("banned_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("ban_reason", sa.Text(), nullable=False, server_default=""))
    op.create_table("account_moderation_actions", sa.Column("id", sa.String(36), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("admin_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False), sa.Column("action", sa.String(30), nullable=False), sa.Column("reason", sa.Text(), nullable=False), sa.Column("banned_until", sa.DateTime(timezone=True), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_account_moderation_actions_user_id", "account_moderation_actions", ["user_id"])
    op.create_index("ix_account_moderation_actions_admin_id", "account_moderation_actions", ["admin_id"])
    op.create_index("ix_account_moderation_actions_action", "account_moderation_actions", ["action"])


def downgrade() -> None:
    op.drop_table("account_moderation_actions")
    op.drop_column("users", "ban_reason")
    op.drop_column("users", "banned_until")
    op.drop_column("users", "is_banned")
