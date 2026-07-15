"""add_rating_to_scan_metrics

Revision ID: d07bc43b7351
Revises: 82d27db126fb
Create Date: 2026-07-10 20:30:15.165868

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd07bc43b7351'
down_revision: Union[str, Sequence[str], None] = '82d27db126fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("scan_metrics", sa.Column("rating", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "chk_metric_rating_range",
        "scan_metrics",
        "rating IS NULL OR (rating BETWEEN 1 AND 5)"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("chk_metric_rating_range", "scan_metrics", type_="check")
    op.drop_column("scan_metrics", "rating")
