import secrets
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text, func
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.api.deps import get_current_user, get_db_session
from app.core.redis import get_redis
from app.core.security import get_password_hash
from app.models.tenant import Tenant
from app.models.location import Location
from app.models.user import User
from app.models.nfc_card import NFCCard
from app.schemas.superadmin import (
    SuperadminTenantCreate,
    SuperadminTenantResponse,
    SuperadminTenantStatusUpdate,
    SuperadminTenantListResponse,
    SuperadminTenantListItem,
    SuperadminLocationUpdate
)
from app.services.resolver import ResolverService

router = APIRouter()

@router.post("/tenants", response_model=SuperadminTenantResponse, status_code=status.HTTP_201_CREATED)
async def provision_tenant(
    payload: SuperadminTenantCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> SuperadminTenantResponse:
    """
    Endpoint para que el súper administrador aprovisione un nuevo tenant (cliente B2B).
    Crea el tenant, el local comercial base, la cuenta administrativa inicial y el short_code NFC.
    """
    # 1. Validar permisos de súper administrador
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida a súper administradores globales."
        )

    # 2. Configurar la transacción como 'superadmin' en PostgreSQL para consultar y escribir
    # sin las restricciones ordinarias de RLS (ya que vamos a crear registros transversales).
    await db.execute(
        text("SELECT set_config('app.current_user_role', 'superadmin', true)")
    )

    # 3. Validar si el email del administrador ya existe (normalizando a minúsculas)
    clean_email = payload.email.strip().lower()
    user_exists = await db.execute(select(User).where(func.lower(User.email) == clean_email))
    if user_exists.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico del administrador ya está registrado en el sistema."
        )

    # 4. Validar u obtener el short_code NFC
    short_code = payload.short_code
    if short_code:
        code_exists = await db.execute(select(NFCCard).where(NFCCard.short_code == short_code))
        if code_exists.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El código corto '{short_code}' ya está en uso por otra tarjeta NFC."
            )
    else:
        # Generar código corto aleatorio y único de 8 caracteres hexadecimales
        while True:
            short_code = secrets.token_hex(4).lower()
            code_exists = await db.execute(select(NFCCard).where(NFCCard.short_code == short_code))
            if not code_exists.scalars().first():
                break

    # 5. Generar contraseña temporal segura
    temporary_password = f"TEMP_{secrets.token_urlsafe(8)}"
    hashed_password = get_password_hash(temporary_password)

    try:
        # 6. Crear el registro del Tenant (Inquilino)
        tenant = Tenant(name=payload.name, is_active=True)
        db.add(tenant)
        await db.flush()  # Generar el UUID del Tenant

        # 7. Crear el Local inicial asociado (Branding por defecto)
        location = Location(
            tenant_id=tenant.id,
            name=payload.name,
            google_maps_url=payload.google_maps_url if payload.google_maps_url else "https://maps.google.com",
            primary_color="#3b82f6",
            secondary_color="#1d4ed8"
        )
        db.add(location)
        await db.flush()  # Generar el UUID del Local

        # 8. Crear el Usuario Administrador asociado
        user = User(
            tenant_id=tenant.id,
            email=clean_email,
            password_hash=hashed_password,
            role="admin",
            requires_password_change=True
        )
        db.add(user)
        await db.flush()  # Generar UUID del Usuario

        # 9. Crear la tarjeta/código NFC asociado al Local y Tenant
        nfc_card = NFCCard(
            location_id=location.id,
            tenant_id=tenant.id,
            short_code=short_code
        )
        db.add(nfc_card)

        # 10. Persistir los cambios en la base de datos
        await db.commit()

        return SuperadminTenantResponse(
            tenant_id=tenant.id,
            location_id=location.id,
            user_id=user.id,
            email=user.email,
            temporary_password=temporary_password,
            short_code=short_code
        )

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en la creación del tenant: {str(e)}"
        )

@router.put("/tenants/{tenant_id}/status")
async def update_tenant_status(
    tenant_id: uuid.UUID,
    payload: SuperadminTenantStatusUpdate,
    db: AsyncSession = Depends(get_db_session),
    redis_conn: aioredis.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint para activar o suspender la cuenta de un tenant (por ejemplo, en caso de impago).
    Invalida de forma reactiva la caché de todas las tarjetas NFC del local para una suspensión en tiempo real.
    """
    # 1. Validar permisos de súper administrador
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida a súper administradores globales."
        )

    # 2. Configurar la transacción como 'superadmin' en PostgreSQL para saltar RLS
    await db.execute(
        text("SELECT set_config('app.current_user_role', 'superadmin', true)")
    )

    # 3. Buscar al Tenant
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalars().first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inquilino (Tenant) no encontrado en el sistema."
        )

    if tenant.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede modificar el estado de un inquilino eliminado."
        )

    tenant.is_active = payload.is_active
    tenant.updated_at = datetime.now()
    
    await db.commit()

    # 5. Invalidar reactivamente la caché de Redis para todas las tarjetas de este Tenant
    # Esto asegura que el bloqueo sea inmediato (los clientes verán la pantalla de suspensión)
    await ResolverService.invalidate_tenant_cache(db, redis_conn, tenant.id)

    return {
        "tenant_id": tenant.id,
        "name": tenant.name,
        "is_active": tenant.is_active,
        "updated_at": datetime.now()
    }

@router.get("/tenants", response_model=SuperadminTenantListResponse)
async def list_tenants(
    page: int = 1,
    limit: int = 10,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> SuperadminTenantListResponse:
    """
    Endpoint para listar todos los inquilinos (tenants) registrados en la plataforma.
    Retorna información agregada del local principal, el email del administrador y el short_code NFC.
    """
    # 1. Validar permisos de súper administrador
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida a súper administradores globales."
        )

    # 2. Configurar la transacción como 'superadmin' en PostgreSQL para saltar RLS
    await db.execute(
        text("SELECT set_config('app.current_user_role', 'superadmin', true)")
    )

    # Calcular offset
    offset = (page - 1) * limit

    try:
        # 3. Obtener el total de tenants no eliminados lógicamente
        count_query = select(func.count(Tenant.id)).where(Tenant.deleted_at.is_(None))
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # 4. Obtener la lista de inquilinos con su email, short_code y google_maps_url
        # Se usan subqueries correlacionadas para evitar duplicar filas cuando un
        # tenant tiene múltiples NFCCards o Locations (producto cartesiano en JOINs).
        admin_email_subq = (
            select(User.email)
            .where((User.tenant_id == Tenant.id) & (User.role == "admin"))
            .limit(1)
            .correlate(Tenant)
            .scalar_subquery()
        )
        short_code_subq = (
            select(NFCCard.short_code)
            .where(NFCCard.tenant_id == Tenant.id)
            .order_by(NFCCard.created_at.asc())
            .limit(1)
            .correlate(Tenant)
            .scalar_subquery()
        )
        google_maps_subq = (
            select(Location.google_maps_url)
            .where(Location.tenant_id == Tenant.id)
            .order_by(Location.created_at.asc())
            .limit(1)
            .correlate(Tenant)
            .scalar_subquery()
        )

        query = (
            select(
                Tenant.id,
                Tenant.name,
                Tenant.is_active,
                Tenant.created_at,
                admin_email_subq.label("admin_email"),
                short_code_subq.label("short_code"),
                google_maps_subq.label("google_maps_url")
            )
            .where(Tenant.deleted_at.is_(None))
            .order_by(Tenant.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        result = await db.execute(query)
        rows = result.all()

        items = []
        for row in rows:
            items.append(
                SuperadminTenantListItem(
                    id=row.id,
                    name=row.name,
                    is_active=row.is_active,
                    created_at=row.created_at,
                    admin_email=row.admin_email,
                    short_code=row.short_code,
                    google_maps_url=row.google_maps_url
                )
            )

        import math
        pages = math.ceil(total / limit) if total > 0 else 1

        return SuperadminTenantListResponse(
            items=items,
            total=total,
            page=page,
            pages=pages
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al listar los tenants: {str(e)}"
        )

@router.put("/tenants/{tenant_id}/location")
async def update_tenant_location(
    tenant_id: uuid.UUID,
    payload: SuperadminLocationUpdate,
    db: AsyncSession = Depends(get_db_session),
    redis_conn: aioredis.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint para que el súper administrador actualice el nombre del local y su URL de Google Maps.
    Esto permite dar soporte técnico si un cliente ingresa mal su enlace.
    Invalida reactivamente la caché de Redis del local para cambios en tiempo real.
    """
    # 1. Validar permisos de súper administrador
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida a súper administradores globales."
        )

    # 2. Configurar la transacción como 'superadmin' en PostgreSQL para saltar RLS
    await db.execute(
        text("SELECT set_config('app.current_user_role', 'superadmin', true)")
    )

    # 3. Buscar al Tenant y asegurar que no esté eliminado
    result_tenant = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result_tenant.scalars().first()
    if not tenant or tenant.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inquilino (Tenant) no encontrado o eliminado."
        )

    # 4. Buscar la Localización asociada al Tenant
    result_loc = await db.execute(select(Location).where(Location.tenant_id == tenant_id))
    location = result_loc.scalars().first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Local comercial no encontrado para este inquilino."
        )

    # 5. Actualizar campos
    location.name = payload.name
    location.google_maps_url = payload.google_maps_url
    
    # También actualizamos el nombre del tenant para mantener coherencia en las tablas
    tenant.name = payload.name

    await db.commit()

    # 6. Invalidar reactivamente la caché en Redis
    await ResolverService.invalidate_tenant_cache(db, redis_conn, tenant.id)

    return {
        "tenant_id": tenant.id,
        "name": location.name,
        "google_maps_url": location.google_maps_url,
        "updated_at": datetime.now()
    }

@router.post("/tenants/{tenant_id}/reset-password")
async def reset_tenant_password(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """
    Genera una nueva contraseña temporal para el administrador de un local.
    Establece requires_password_change = True para forzar el cambio en el próximo inicio de sesión.
    Esto permite el restablecimiento asistido si un cliente olvida su clave.
    """
    import secrets

    # 1. Validar permisos de súper administrador
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operación restringida a súper administradores globales."
        )

    # 2. Configurar la transacción como 'superadmin' en PostgreSQL para saltar RLS
    await db.execute(
        text("SELECT set_config('app.current_user_role', 'superadmin', true)")
    )

    # 3. Buscar al Tenant y asegurar que no esté eliminado
    result_tenant = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result_tenant.scalars().first()
    if not tenant or tenant.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inquilino (Tenant) no encontrado o eliminado."
        )

    # 4. Buscar el Usuario administrador asociado a este Tenant
    result_user = await db.execute(
        select(User).where((User.tenant_id == tenant_id) & (User.role == "admin"))
    )
    user = result_user.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario administrador no encontrado para este inquilino."
        )

    # 5. Generar contraseña temporal e inyectarla
    temp_password = f"TEMP_{secrets.token_urlsafe(8)}"
    user.password_hash = get_password_hash(temp_password)
    user.requires_password_change = True

    await db.commit()

    return {
        "tenant_id": tenant_id,
        "email": user.email,
        "temporary_password": temp_password
    }
