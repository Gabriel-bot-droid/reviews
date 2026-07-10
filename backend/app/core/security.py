from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
import bcrypt
from jose import jwt
from app.core.config import settings

# Algoritmo estándar para firmas de tokens JWT
ALGORITHM = "HS256"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica que la contraseña en texto plano coincida con el hash cifrado de la base de datos.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), 
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """
    Cifra una contraseña en texto plano generando un hash seguro usando bcrypt.
    """
    # Genera la sal y el hash de forma nativa e independiente de passlib
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def create_access_token(
    subject: Union[str, Any],
    tenant_id: Optional[Union[str, Any]] = None,
    role: str = "admin",
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Genera un token de acceso JWT firmado digitalmente con el JWT_SECRET_KEY.
    El token almacena la expiración, el identificador de usuario (sub), el rol
    y el identificador de inquilino (tenant_id) para la seguridad multi-tenant.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role,
        "tenant_id": str(tenant_id) if tenant_id else None
    }
    
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET_KEY, 
        algorithm=ALGORITHM
    )
    return encoded_jwt
