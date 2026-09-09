"""Store foreground GPS track samples. / 保存网页前台 GPS 轨迹采样点。"""

from alembic import op
import sqlalchemy as sa


revision = "20260909_0011"
down_revision = "20260907_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "travel_track_points",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("route_id", sa.String(36), sa.ForeignKey("travel_routes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("accuracy_meters", sa.Float(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("route_id", "sequence", name="uq_travel_track_point_sequence"),
    )
    op.create_index("ix_travel_track_points_route_id", "travel_track_points", ["route_id"])


def downgrade() -> None:
    op.drop_index("ix_travel_track_points_route_id", table_name="travel_track_points")
    op.drop_table("travel_track_points")
