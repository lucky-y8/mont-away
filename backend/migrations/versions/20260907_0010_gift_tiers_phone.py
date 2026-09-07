"""Confirm gift tiers and delivery phone. / 固化礼品积分档位与收货电话字段。"""

from alembic import op
import sqlalchemy as sa

revision = "20260907_0010"
down_revision = "20260907_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Move legacy costs upward to the next confirmed tier. / 历史积分向上归入最近的已确认档位。
    op.execute("UPDATE gifts SET point_cost = CASE WHEN point_cost <= 20 THEN 20 WHEN point_cost <= 40 THEN 40 WHEN point_cost <= 60 THEN 60 WHEN point_cost <= 80 THEN 80 ELSE 100 END")
    with op.batch_alter_table("gifts") as batch:
        batch.drop_constraint("ck_gift_positive_cost", type_="check")
        batch.create_check_constraint("ck_gift_point_tier", "point_cost IN (20, 40, 60, 80, 100)")
    with op.batch_alter_table("gift_redemptions") as batch:
        batch.alter_column("contact", new_column_name="phone", existing_type=sa.String(200), type_=sa.String(32), nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("gift_redemptions") as batch:
        batch.alter_column("phone", new_column_name="contact", existing_type=sa.String(32), type_=sa.String(200), nullable=False)
    with op.batch_alter_table("gifts") as batch:
        batch.drop_constraint("ck_gift_point_tier", type_="check")
        batch.create_check_constraint("ck_gift_positive_cost", "point_cost > 0")
