from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """
    Endpoint para iniciar sesión en la API administrativa.
    Verifica las credenciales y el estado activo del inquilino, y emite un token JWT.
    """
    # Para buscar al usuario por correo en la tabla 'users' (que tiene RLS),
    # debemos configurar la sesión temporalmente con el rol 'superadmin' 
    # ya que en este punto el cliente aún no está autenticado.
    await db.execute(
        text("SELECT set_config('app.current_user_role', 'superadmin', true)")
    )
    
    # Buscar al usuario por email
    result = await db.execute(
        select(User).where(User.email == credentials.email)
    )
    user = result.scalars().first()
    
    # Verificar usuario y contraseña
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El correo electrónico o la contraseña son incorrectos.",
        )
        
    # Si el usuario no es superadmin, validar el estado de su organización (tenant)
    if user.role != "superadmin":
        result_tenant = await db.execute(
            select(Tenant).where(Tenant.id == user.tenant_id)
        )
        tenant = result_tenant.scalars().first()
        
        # Validar si el tenant existe, está activo y no está borrado lógicamente
        if not tenant or not tenant.is_active or tenant.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La cuenta de esta organización se encuentra inactiva o suspendida.",
            )
            
    # Generar el token de acceso JWT
    access_token = create_access_token(
        subject=user.id,
        tenant_id=user.tenant_id,
        role=user.role
    )
    
    # Retornar la respuesta con el token y su expiración en segundos
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
