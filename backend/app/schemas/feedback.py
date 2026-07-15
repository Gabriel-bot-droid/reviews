import html
import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

class FeedbackCreate(BaseModel):
    """
    Esquema para la creación de un feedback anónimo enviado por un cliente.
    """
    rating: int = Field(..., ge=1, le=5, description="Calificación en estrellas (1-5)")
    comment: Optional[str] = Field(
        None, 
        max_length=1000, 
        description="Comentario descriptivo del cliente"
    )

    @field_validator("comment")
    @classmethod
    def sanitize_comment(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return html.escape(v.strip())
        return v

class FeedbackResponse(BaseModel):
    """
    Esquema de respuesta para las quejas o comentarios registrados.
    """
    id: uuid.UUID
    rating: int
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class FeedbackHistoryResponse(BaseModel):
    """
    Esquema de respuesta paginado para el historial de opiniones.
    """
    items: List[FeedbackResponse]
    total_items: int
    page: int
    total_pages: int
