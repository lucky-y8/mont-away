"""Prepare media uploads. / 补充媒体上传字段。"""

from alembic import op
import sqlalchemy as sa

revision = "20260904_0004"
down_revision = "20260904_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("media_assets") as batch:
        batch.add_column(sa.Column("user_id", sa.String(36), nullable=True))
        batch.add_column(sa.Column("content_type", sa.String(100), nullable=False, server_default="application/octet-stream"))
        batch.add_column(sa.Column("size_bytes", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("created_at", sa.DateTime(timezone=True), nullable=True))
        batch.alter_column("post_version_id", existing_type=sa.String(36), nullable=True)
        batch.create_foreign_key("fk_media_assets_user_id", "users", ["user_id"], ["id"], ondelete="CASCADE")
        batch.create_index("ix_media_assets_user_id", ["user_id"])


def downgrade() -> None:
    with op.batch_alter_table("media_assets") as batch:
        batch.drop_index("ix_media_assets_user_id")
        batch.drop_constraint("fk_media_assets_user_id", type_="foreignkey")
        batch.alter_column("post_version_id", existing_type=sa.String(36), nullable=False)
        batch.drop_column("created_at")
        batch.drop_column("size_bytes")
        batch.drop_column("content_type")
        batch.drop_column("user_id")
