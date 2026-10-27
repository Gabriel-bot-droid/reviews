import re
from pydantic import BaseModel, Field, field_validator

# Regex estándar para validación básica de correos electrónicos
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

class LoginRequest(BaseModel):
    """
    Esquema para validar las credenciales de inicio de sesión de un administrador.
    Realiza limpieza de espacios y validación de sintaxis del email.
    """
    email: str
    password: str = Field(..., min_length=1, description="Contraseña de acceso")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        # Limpiar espacios y normalizar a minúsculas
        email = v.strip().lower()
        if not EMAIL_REGEX.match(email):
            raise ValueError("El correo electrónico no tiene un formato válido.")
        return email

class TokenResponse(BaseModel):
    """
    Esquema que define la respuesta exitosa tras el inicio de sesión.
    Retorna el token JWT de acceso.
    """
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class PasswordChangeRequest(BaseModel):
    """
    Esquema de entrada para actualizar la contraseña del usuario logueado.
    """
    current_password: str = Field(..., min_length=1, description="Contraseña actual o temporal")
    new_password: str = Field(..., min_length=6, max_length=100, description="Nueva contraseña definitiva")
