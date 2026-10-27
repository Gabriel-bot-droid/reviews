import os
import anyio
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.api.deps import get_db_session, get_current_user
from app.core.redis import get_redis
from app.models.location import Location
from app.models.user import User
from app.schemas.location import LocationResponse, LocationUpdate
from app.services.resolver import ResolverService

router = APIRouter()

@router.get("", response_model=LocationResponse)
async def get_location(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> LocationResponse:
    """
    Obtiene la configuración visual y de redirección del local asociado al inquilino (Tenant) del administrador.
    El aislamiento de inquilinos es garantizado implícitamente por Row-Level Security (RLS) en Postgres.
    """
    if current_user.role == "superadmin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los súper administradores globales no administran un único local directo."
        )
        
    result = await db.execute(select(Location))
    location = result.scalars().first()
    
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración visual del local no encontrada."
        )
        
    return location

@router.put("", response_model=LocationResponse)
async def update_location(
    payload: LocationUpdate,
    db: AsyncSession = Depends(get_db_session),
    redis_conn: aioredis.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user)
) -> LocationResponse:
    """
    Actualiza la configuración visual de marca (colores, logo, nombre) y la URL de redirección a Google Maps.
    Invalida reactivamente la caché de Redis de todas las tarjetas NFC vinculadas al local.
    """
    if current_user.role == "superadmin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los súper administradores globales no pueden modificar locales directamente."
        )
        
    result = await db.execute(select(Location))
    location = result.scalars().first()
    
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración del local no encontrada."
        )
        
    # Actualizar valores
    location.name = payload.name
    location.logo_url = payload.logo_url
    if payload.primary_color is not None:
        location.primary_color = payload.primary_color
    if payload.secondary_color is not None:
        location.secondary_color = payload.secondary_color
    location.google_maps_url = payload.google_maps_url
    
    # Guardar cambios en la base de datos
    await db.commit()
    
    # Invalida de forma reactiva la caché en Redis de todas las tarjetas NFC asociadas a este local
    # para que los cambios visuales y de redirección se propaguen de inmediato a los clientes
    await ResolverService.invalidate_location_cache(db, redis_conn, location.id)
    
    # Retornar el local actualizado
    return location


# Limitar tamaño de imagen a 2MB (2 * 1024 * 1024 bytes)
MAX_FILE_SIZE = 2 * 1024 * 1024
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}

@router.post("/logo", response_model=LocationResponse)
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    redis_conn: aioredis.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user)
) -> LocationResponse:
    """
    Sube una imagen de logotipo local desde el ordenador del administrador.
    Guarda el archivo en el sistema de estáticos, actualiza el campo logo_url e invalida la caché de Redis.
    """
    if current_user.role == "superadmin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los súper administradores globales no pueden subir logotipos directamente."
        )

    # 1. Validar extensión del archivo
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión de archivo no permitida. Formatos aceptados: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # 2. Validar tamaño del archivo (leyendo el archivo)
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El logotipo es demasiado pesado. El tamaño máximo permitido es de 2MB."
        )

    # 3. Obtener el local actual del administrador
    result = await db.execute(select(Location))
    location = result.scalars().first()
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuración visual del local no encontrada."
        )

    # 4. Generar el nombre de archivo único
    # Guardamos en static/uploads/{location_id}{extension}
    filename = f"{location.id}{file_ext}"
    static_dir = Path("static/uploads")
    static_dir.mkdir(parents=True, exist_ok=True)
    file_path = static_dir / filename

    # 5. Escribir el archivo en disco de forma no bloqueante en un hilo de fondo
    def save_file_sync(path: Path, data: bytes) -> None:
        with open(path, "wb") as f:
            f.write(data)

    await anyio.to_thread.run_sync(save_file_sync, file_path, contents)

    # 6. Actualizar url en base de datos
    location.logo_url = f"/static/uploads/{filename}"
    
    await db.commit()

    # 7. Invalidar la caché de Redis
    await ResolverService.invalidate_location_cache(db, redis_conn, location.id)

    return location

