from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.core.database import get_db
from app.core.redis import get_redis
from app.core.limiter import limiter
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from app.schemas.metric import MetricCreate
from app.services.resolver import ResolverService
from app.models.feedback import Feedback
from app.models.metric import ScanMetric

router = APIRouter()

@router.get("/{short_code}")
async def resolve_code(
    short_code: str,
    db: AsyncSession = Depends(get_db),
    redis_conn: aioredis.Redis = Depends(get_redis)
):
    """
    Endpoint público para resolver un código corto NFC/QR en branding visual de local.
    Soporta almacenamiento en caché de Redis para lograr respuestas rápidas.
    """
    location_data = await ResolverService.resolve_short_code(db, redis_conn, short_code)
    if not location_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El código NFC/QR consultado no existe o pertenece a un servicio suspendido."
        )
    return location_data

@router.post("/{short_code}/feedback", response_model=FeedbackResponse)
@limiter.limit("3/minute")
async def create_feedback(
    request: Request,
    short_code: str,
    payload: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    redis_conn: aioredis.Redis = Depends(get_redis)
) -> FeedbackResponse:
    """
    Endpoint público para registrar calificaciones y comentarios de clientes de forma anónima.
    Aplica límite de tasa (Rate Limiting) de hasta 3 envíos por minuto por IP.
    """
    # Validar que el código corto NFC exista
    location_data = await ResolverService.resolve_short_code(db, redis_conn, short_code)
    if not location_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Código de tarjeta NFC no encontrado o inactivo."
        )
        
    # Dado que los feedbacks son anónimos (no hay token Bearer), debemos ejecutar
    # la transacción como 'superadmin' en el motor de base de datos para saltar RLS.
    await db.execute(
        text("SELECT set_config('app.current_user_role', 'superadmin', true)")
    )
    
    # Crear el registro del feedback
    new_feedback = Feedback(
        location_id=location_data["location_id"],
        tenant_id=location_data["tenant_id"],
        rating=payload.rating,
        comment=payload.comment
    )
    db.add(new_feedback)
    await db.commit()
    
    return new_feedback

@router.post("/{short_code}/metric")
async def record_metric(
    short_code: str,
    payload: MetricCreate,
    db: AsyncSession = Depends(get_db),
    redis_conn: aioredis.Redis = Depends(get_redis)
):
    """
    Endpoint público para registrar de forma cuantitativa eventos de escaneo de tarjeta
    o de redirección a Google Maps para analíticas internas.
    """
    # Validar que el código corto NFC exista
    location_data = await ResolverService.resolve_short_code(db, redis_conn, short_code)
    if not location_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Código de tarjeta NFC no encontrado o inactivo."
        )
        
    # Establecer rol 'superadmin' para permitir inserción de métricas públicas sin sesión de usuario
    await db.execute(
        text("SELECT set_config('app.current_user_role', 'superadmin', true)")
    )
    
    # Registrar la métrica cuantitativa
    new_metric = ScanMetric(
        location_id=location_data["location_id"],
        tenant_id=location_data["tenant_id"],
        event_type=payload.event_type,
        rating=payload.rating
    )
    db.add(new_metric)
    await db.commit()
    
    return {"status": "recorded"}
