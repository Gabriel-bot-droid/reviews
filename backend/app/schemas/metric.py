from typing import Literal, Optional
from pydantic import BaseModel, Field

class MetricCreate(BaseModel):
    """
    Esquema para capturar y validar eventos métricos cuantitativos.
    Restringe los eventos a 'SCAN' (escaneo de la tarjeta) o 'CLICK_GOOGLE' (redirección a Maps).
    """
    event_type: Literal["SCAN", "CLICK_GOOGLE"] = Field(
        ..., 
        description="El tipo de evento registrado: 'SCAN' o 'CLICK_GOOGLE'"
    )
    rating: Optional[int] = Field(
        None,
        ge=1,
        le=5,
        description="Calificación opcional asociada al evento"
    )
