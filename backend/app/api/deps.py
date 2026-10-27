import uuid
from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db, get_tenant_db
from app.core.security import ALGORITHM
from app.models.user import User
from app.models.tenant import Tenant

# Dependencia para requerir el esquema HTTP Bearer (Token JWT)
reusable_oauth2 = HTTPBearer()

async def get_current_user(
    request: Request,
    http_auth: HTTPAuthorizationCredentials = Depends(reusable_oauth2),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependencia que extrae y valida el token JWT de la cabecera HTTP.
    Verifica que el usuario exista y que su tenant esté activo y no eliminado.
    """
    try:
        # Decodificar el token JWT
        payload = jwt.decode(
            http_auth.credentials, 
            settings.JWT_SECRET_KEY, 
            algorithms=[ALGORITHM]
        )
        token_data_sub: str = payload.get("sub")
        if token_data_sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="El token no contiene el identificador de usuario.",
            )
        user_id = uuid.UUID(token_data_sub)
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
        )
    
    # Para validar la existencia del usuario y su inquilino, la base de datos
    # requiere que la sesión actúe temporalmente como 'superadmin' en esta consulta,
    # ya que de lo contrario las políticas RLS bloquearían la lectura de la tabla 'users'.
    await db.execute(
        text("SELECT set_config('app.current_user_role', 'superadmin', true)")
    )
    
    # Buscar al usuario
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado.",
        )
    
    # Si el usuario es de un tenant (no súper administrador), verificar estado
    if user.role != "superadmin":
        result_tenant = await db.execute(
            select(Tenant).where(Tenant.id == user.tenant_id)
        )
        tenant = result_tenant.scalars().first()
        
        # Validación de cuenta activa y no eliminada lógicamente
        if not tenant or not tenant.is_active or tenant.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El servicio para esta organización ha sido suspendido o eliminado.",
            )
            
    # Bloqueo de seguridad corporativo: Si el usuario requiere cambiar su contraseña obligatoriamente,
    # denegar el acceso a cualquier endpoint excepto la actualización de contraseña (PUT /v1/auth/password)
    if user.requires_password_change:
        is_change_password_route = (
            request.url.path.rstrip("/") == "/v1/auth/password" 
            and request.method == "PUT"
        )
        if not is_change_password_route:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="PASSWORD_CHANGE_REQUIRED",
            )

    return user

async def get_db_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> AsyncGenerator[AsyncSession, None]:
    """
    Dependencia inyectable para endpoints del panel de administración.
    Reutiliza la misma sesión de base de datos asíncrona de get_current_user,
    configurando las variables RLS basándose en el inquilino y rol del usuario.
    """
    # Configurar el rol si existe en el JWT/Usuario
    if current_user.role:
        await db.execute(
            text("SELECT set_config('app.current_user_role', :role, true)"),
            {"role": current_user.role}
        )
    
    # Configurar el tenant_id si existe y el rol no es súper administrador
    if current_user.tenant_id and current_user.role != "superadmin":
        await db.execute(
            text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
            {"tenant_id": str(current_user.tenant_id)}
        )
    
    yield db
