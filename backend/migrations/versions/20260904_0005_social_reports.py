"""Create comments, bookmarks and reports. / 创建评论、收藏和举报表。"""

from alembic import op
import sqlalchemy as sa

revision = "20260904_0005"
down_revision = "20260904_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("post_bookmarks", sa.Column("id", sa.String(36), primary_key=True), sa.Column("post_id", sa.String(36), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("post_id", "user_id", name="uq_post_bookmark_user"))
    op.create_index("ix_post_bookmarks_post_id", "post_bookmarks", ["post_id"])
    op.create_index("ix_post_bookmarks_user_id", "post_bookmarks", ["user_id"])
    op.create_table("post_comments", sa.Column("id", sa.String(36), primary_key=True), sa.Column("post_id", sa.String(36), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("body", sa.Text(), nullable=False), sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_post_comments_post_id", "post_comments", ["post_id"])
    op.create_index("ix_post_comments_user_id", "post_comments", ["user_id"])
    op.create_index("ix_post_comments_is_deleted", "post_comments", ["is_deleted"])
    op.create_table("post_reports", sa.Column("id", sa.String(36), primary_key=True), sa.Column("post_id", sa.String(36), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False), sa.Column("reporter_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("category", sa.String(30), nullable=False), sa.Column("reason", sa.Text(), nullable=False), sa.Column("status", sa.String(20), nullable=False), sa.Column("resolution", sa.Text(), nullable=False), sa.Column("resolved_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True), sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("post_id", "reporter_id", name="uq_post_reporter"))
    op.create_index("ix_post_reports_post_id", "post_reports", ["post_id"])
    op.create_index("ix_post_reports_reporter_id", "post_reports", ["reporter_id"])
    op.create_index("ix_post_reports_status", "post_reports", ["status"])


def downgrade() -> None:
    op.drop_table("post_reports")
    op.drop_table("post_comments")
    op.drop_table("post_bookmarks")
