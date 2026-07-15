import re
import uuid
from typing import Optional
from pydantic import BaseModel, Field, field_validator

# Expresión regular para validar colores en formato hexadecimal de 6 dígitos (ej: #FF5733)
HEX_COLOR_REGEX = re.compile(r"^#[0-9a-fA-F]{6}$")

class LocationUpdate(BaseModel):
    """
    Esquema para validar la actualización de un local por parte de su administrador.
    Valida formatos cromáticos hexadecimales y la longitud de URLs y nombres.
    """
    name: str = Field(..., min_length=1, max_length=255)
    logo_url: Optional[str] = Field(None, max_length=512)
    primary_color: str = Field(..., description="Color primario hexadecimal (ej: #FF5733)")
    secondary_color: str = Field(..., description="Color secundario hexadecimal (ej: #FFFFFF)")
    google_maps_url: str = Field(..., min_length=10, description="URL de la ficha de Google Maps")

    @field_validator("primary_color", "secondary_color")
    @classmethod
    def validate_hex_color(cls, v: str) -> str:
        if not HEX_COLOR_REGEX.match(v):
            raise ValueError(
                "El color debe estar en formato hexadecimal válido de 6 dígitos (ej: #FF5733)."
            )
        return v

class LocationResponse(BaseModel):
    """
    Esquema de respuesta para la información de un local.
    """
    id: uuid.UUID
    name: str
    logo_url: Optional[str]
    primary_color: str
    secondary_color: str
    google_maps_url: str

    class Config:
        from_attributes = True
