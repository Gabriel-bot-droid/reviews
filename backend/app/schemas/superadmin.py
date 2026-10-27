import re
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

# Regex para validación de email
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

class SuperadminTenantCreate(BaseModel):
    """
    Esquema de entrada para que el súper administrador cree un nuevo tenant.
    """
    name: str = Field(..., min_length=2, max_length=100, description="Nombre del negocio o tenant")
    email: str = Field(..., description="Email de contacto del dueño/administrador inicial")
    short_code: Optional[str] = Field(None, min_length=3, max_length=20, description="Código corto opcional personalizado para NFC")
    google_maps_url: Optional[str] = Field(None, description="URL de la ficha de Google Maps del negocio")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        email = v.strip().lower()
        if not EMAIL_REGEX.match(email):
            raise ValueError("El correo electrónico no tiene un formato válido.")
        return email

    @field_validator("short_code")
    @classmethod
    def validate_short_code(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = v.strip().lower()
        # Permitir solo caracteres alfanuméricos y guiones
        if not re.match(r"^[a-z0-9-_]+$", cleaned):
            raise ValueError("El código corto solo puede contener caracteres alfanuméricos, guiones o guiones bajos.")
        return cleaned

class SuperadminTenantResponse(BaseModel):
    """
    Esquema de salida tras aprovisionar exitosamente un nuevo tenant.
    """
    tenant_id: uuid.UUID
    location_id: uuid.UUID
    user_id: uuid.UUID
    email: str
    temporary_password: str
    short_code: str

    class Config:
        from_attributes = True

class SuperadminTenantStatusUpdate(BaseModel):
    """
    Esquema para actualizar el estado de activación de un tenant (suspensión/reactivación).
    """
    is_active: bool
    reason: Optional[str] = Field(None, description="Razón del cambio de estado")

class SuperadminTenantListItem(BaseModel):
    id: uuid.UUID
    name: str
    is_active: bool
    created_at: datetime
    admin_email: Optional[str] = None
    short_code: Optional[str] = None
    google_maps_url: Optional[str] = None

    class Config:
        from_attributes = True

class SuperadminTenantListResponse(BaseModel):
    items: list[SuperadminTenantListItem]
    total: int
    page: int
    pages: int

class SuperadminLocationUpdate(BaseModel):
    """
    Esquema para actualizar los datos comerciales (nombre y Google Maps) desde superadmin.
    """
    name: str = Field(..., min_length=2, max_length=100, description="Nombre comercial del local")
    google_maps_url: str = Field(..., description="Nueva URL de reseñas en Google Maps")
