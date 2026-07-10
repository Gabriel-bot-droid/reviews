import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, Text, DateTime, ForeignKey, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Feedback(Base):
    __tablename__ = "feedbacks"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, 
        default=uuid.uuid4
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT"), 
        nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), 
        nullable=False
    )
    rating: Mapped[int] = mapped_column(
        Integer, 
        nullable=False
    )
    comment: Mapped[Optional[str]] = mapped_column(
        Text, 
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relaciones
    location: Mapped["Location"] = relationship(back_populates="feedbacks")
    tenant: Mapped["Tenant"] = relationship()

    # Restricciones a nivel de tabla
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="chk_feedback_rating_range"),
        CheckConstraint(
            "(rating IN (4, 5)) OR (rating IN (1, 2, 3) AND comment IS NOT NULL AND char_length(comment) >= 10)",
            name="chk_feedback_comment_rating"
        ),
    )
