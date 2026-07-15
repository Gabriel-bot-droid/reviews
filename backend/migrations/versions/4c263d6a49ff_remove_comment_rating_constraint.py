"""remove_comment_rating_constraint

Revision ID: 4c263d6a49ff
Revises: 6afe500402e4
Create Date: 2026-07-10 15:50:53.058112

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c263d6a49ff'
down_revision: Union[str, Sequence[str], None] = '6afe500402e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Eliminar la restricción Check que obligaba a tener comentarios en bajas calificaciones
    op.drop_constraint("chk_feedback_comment_rating", "feedbacks", type_="check")


def downgrade() -> None:
    """Downgrade schema."""
    # Restaurar la restricción Check en caso de revertir la migración
    op.create_check_constraint(
        "chk_feedback_comment_rating",
        "feedbacks",
        "(rating IN (4, 5)) OR (rating IN (1, 2, 3) AND comment IS NOT NULL AND char_length(comment) >= 10)"
    )
