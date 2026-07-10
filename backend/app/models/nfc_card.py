import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class NFCCard(Base):
    __tablename__ = "nfc_cards"

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
    short_code: Mapped[str] = mapped_column(
        String(20), 
        unique=True, 
        nullable=False, 
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )

    # Relaciones
    location: Mapped["Location"] = relationship(back_populates="nfc_cards")
    tenant: Mapped["Tenant"] = relationship()
