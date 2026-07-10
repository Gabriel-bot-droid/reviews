import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class ScanMetric(Base):
    __tablename__ = "scan_metrics"

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
    event_type: Mapped[str] = mapped_column(
        String(50), 
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relaciones
    location: Mapped["Location"] = relationship(back_populates="scan_metrics")
    tenant: Mapped["Tenant"] = relationship()

    # Restricciones a nivel de tabla
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('SCAN', 'CLICK_GOOGLE')", 
            name="chk_metric_event_type"
        ),
    )
