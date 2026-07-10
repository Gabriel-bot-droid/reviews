import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Location(Base):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, 
        default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), 
        nullable=False
    )
    name: Mapped[str] = mapped_column(
        String(255), 
        nullable=False
    )
    logo_url: Mapped[Optional[str]] = mapped_column(
        String(512), 
        nullable=True
    )
    primary_color: Mapped[str] = mapped_column(
        String(7), 
        default="#000000", 
        server_default="#000000", 
        nullable=False
    )
    secondary_color: Mapped[str] = mapped_column(
        String(7), 
        default="#FFFFFF", 
        server_default="#FFFFFF", 
        nullable=False
    )
    google_maps_url: Mapped[str] = mapped_column(
        Text, 
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False
    )

    # Relaciones
    tenant: Mapped["Tenant"] = relationship(back_populates="locations")
    nfc_cards: Mapped[List["NFCCard"]] = relationship(
        back_populates="location", 
        passive_deletes=True
    )
    feedbacks: Mapped[List["Feedback"]] = relationship(
        back_populates="location", 
        passive_deletes=True
    )
    scan_metrics: Mapped[List["ScanMetric"]] = relationship(
        back_populates="location", 
        passive_deletes=True
    )
