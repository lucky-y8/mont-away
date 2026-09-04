"""Create posts, places and routes. / 创建帖子、景点和路线数据表。"""

from alembic import op
import sqlalchemy as sa

revision = "20260904_0002"
down_revision = "20260904_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("places", sa.Column("id", sa.String(36), primary_key=True), sa.Column("name", sa.String(160), nullable=False), sa.Column("city", sa.String(120), nullable=False), sa.Column("country_code", sa.String(2), nullable=False), sa.Column("latitude", sa.Float(), nullable=False), sa.Column("longitude", sa.Float(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("country_code", "city", "name", name="uq_place_location_name"))
    op.create_index("ix_places_name", "places", ["name"])
    op.create_index("ix_places_city", "places", ["city"])
    op.create_table("posts", sa.Column("id", sa.String(36), primary_key=True), sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("place_id", sa.String(36), sa.ForeignKey("places.id"), nullable=False), sa.Column("current_version_id", sa.String(36), nullable=True), sa.Column("visibility_status", sa.String(20), nullable=False), sa.Column("moderation_status", sa.String(20), nullable=False), sa.Column("reward_status", sa.String(20), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    for column in ("author_id", "place_id", "visibility_status", "moderation_status", "reward_status"):
        op.create_index(f"ix_posts_{column}", "posts", [column])
    op.create_table("post_versions", sa.Column("id", sa.String(36), primary_key=True), sa.Column("post_id", sa.String(36), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False), sa.Column("version_number", sa.Integer(), nullable=False), sa.Column("title", sa.String(120), nullable=False), sa.Column("body", sa.Text(), nullable=False), sa.Column("content_language", sa.String(16), nullable=False), sa.Column("transport_mode", sa.String(30), nullable=True), sa.Column("route_source", sa.String(20), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_post_versions_post_id", "post_versions", ["post_id"])
    op.create_table("travel_routes", sa.Column("id", sa.String(36), primary_key=True), sa.Column("post_version_id", sa.String(36), sa.ForeignKey("post_versions.id", ondelete="CASCADE"), nullable=False), sa.Column("start_name", sa.String(160), nullable=False), sa.Column("start_latitude", sa.Float(), nullable=False), sa.Column("start_longitude", sa.Float(), nullable=False), sa.Column("end_name", sa.String(160), nullable=False), sa.Column("end_latitude", sa.Float(), nullable=False), sa.Column("end_longitude", sa.Float(), nullable=False), sa.Column("distance_meters", sa.Integer(), nullable=True))
    op.create_index("ix_travel_routes_post_version_id", "travel_routes", ["post_version_id"], unique=True)
    op.create_table("route_nodes", sa.Column("id", sa.String(36), primary_key=True), sa.Column("route_id", sa.String(36), sa.ForeignKey("travel_routes.id", ondelete="CASCADE"), nullable=False), sa.Column("sequence", sa.Integer(), nullable=False), sa.Column("name", sa.String(160), nullable=False), sa.Column("description", sa.Text(), nullable=False), sa.Column("latitude", sa.Float(), nullable=False), sa.Column("longitude", sa.Float(), nullable=False), sa.Column("source", sa.String(20), nullable=False), sa.UniqueConstraint("route_id", "sequence", name="uq_route_node_sequence"))
    op.create_index("ix_route_nodes_route_id", "route_nodes", ["route_id"])
    op.create_table("media_assets", sa.Column("id", sa.String(36), primary_key=True), sa.Column("post_version_id", sa.String(36), sa.ForeignKey("post_versions.id", ondelete="CASCADE"), nullable=False), sa.Column("route_node_id", sa.String(36), sa.ForeignKey("route_nodes.id", ondelete="CASCADE"), nullable=True), sa.Column("media_type", sa.String(10), nullable=False), sa.Column("object_key", sa.String(512), nullable=False), sa.Column("position", sa.Integer(), nullable=False))
    op.create_index("ix_media_assets_post_version_id", "media_assets", ["post_version_id"])
    op.create_index("ix_media_assets_route_node_id", "media_assets", ["route_node_id"])
    op.create_table("post_likes", sa.Column("id", sa.String(36), primary_key=True), sa.Column("post_id", sa.String(36), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False), sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("post_id", "user_id", name="uq_post_like_user"))
    op.create_index("ix_post_likes_post_id", "post_likes", ["post_id"])
    op.create_index("ix_post_likes_user_id", "post_likes", ["user_id"])


def downgrade() -> None:
    op.drop_table("post_likes")
    op.drop_table("media_assets")
    op.drop_table("route_nodes")
    op.drop_table("travel_routes")
    op.drop_table("post_versions")
    op.drop_table("posts")
    op.drop_table("places")
