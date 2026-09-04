"""Create moderation, notifications and points. / 创建审核、通知和积分表。"""

from alembic import op
import sqlalchemy as sa

revision = "20260904_0003"
down_revision = "20260904_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table("moderation_actions", sa.Column("id", sa.String(36), primary_key=True), sa.Column("post_id", sa.String(36), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False), sa.Column("post_version_id", sa.String(36), sa.ForeignKey("post_versions.id"), nullable=True), sa.Column("admin_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False), sa.Column("action", sa.String(30), nullable=False), sa.Column("reason", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_moderation_actions_post_id", "moderation_actions", ["post_id"])
    op.create_index("ix_moderation_actions_admin_id", "moderation_actions", ["admin_id"])
    op.create_index("ix_moderation_actions_action", "moderation_actions", ["action"])
    op.create_table("notifications", sa.Column("id", sa.String(36), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("event_type", sa.String(50), nullable=False), sa.Column("resource_id", sa.String(36), nullable=True), sa.Column("payload_json", sa.Text(), nullable=False), sa.Column("read_at", sa.DateTime(timezone=True), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_event_type", "notifications", ["event_type"])
    op.create_table("point_ledger", sa.Column("id", sa.String(36), primary_key=True), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("amount", sa.Integer(), nullable=False), sa.Column("entry_type", sa.String(30), nullable=False), sa.Column("reference_type", sa.String(30), nullable=False), sa.Column("reference_id", sa.String(36), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("reference_type", "reference_id", "entry_type", name="uq_point_reference_entry"))
    op.create_index("ix_point_ledger_user_id", "point_ledger", ["user_id"])
    op.create_index("ix_point_ledger_entry_type", "point_ledger", ["entry_type"])


def downgrade() -> None:
    op.drop_table("point_ledger")
    op.drop_table("notifications")
    op.drop_table("moderation_actions")
    op.drop_column("users", "is_admin")
