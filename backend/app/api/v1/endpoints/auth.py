from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.auth import LoginRequest, TokenResponse, PasswordChangeRequest
from app.api.deps import get_current_user, get_db_session

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
    
    # Buscar al usuario por email (insensible a mayúsculas/minúsculas y espacios extra)
    clean_email = credentials.email.strip().lower()
    result = await db.execute(
        select(User).where(func.lower(User.email) == clean_email)
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
        role=user.role,
        requires_password_change=user.requires_password_change
    )
    
    # Retornar la respuesta con el token y su expiración en segundos
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.put("/password")
async def change_password(
    payload: PasswordChangeRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """
    Permite a un usuario autenticado cambiar su contraseña actual.
    Si tenía activo el flag requires_password_change, se desactiva tras el cambio exitoso.
    """
    # 1. Verificar la contraseña actual
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual ingresada es incorrecta."
        )

    # 2. Cifrar y actualizar la contraseña
    current_user.password_hash = get_password_hash(payload.new_password)
    current_user.requires_password_change = False  # Desactivar flag obligatorio

    await db.commit()

    return {"detail": "Contraseña actualizada exitosamente."}
