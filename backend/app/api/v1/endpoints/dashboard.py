from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.api.deps import get_db_session, get_current_user
from app.models.user import User
from app.models.feedback import Feedback
from app.models.metric import ScanMetric
from app.schemas.dashboard import DashboardResponse

router = APIRouter()

@router.get("", response_model=DashboardResponse)
async def get_dashboard_data(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> DashboardResponse:
    """
    Recupera las métricas analíticas (escaneos, clics) y los comentarios recientes
    del local asignado al administrador autenticado.
    El aislamiento de los datos se realiza a nivel de base de datos de forma automática por RLS.
    """
    if current_user.role == "superadmin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los súper administradores globales deben consultar analíticas por inquilino individual."
        )

    # 1. Total de escaneos de tarjetas (event_type = 'SCAN')
    scans_query = select(func.count(ScanMetric.id)).where(ScanMetric.event_type == "SCAN")
    scans_result = await db.execute(scans_query)
    total_scans = scans_result.scalar() or 0

    # 2. Total de redirecciones a Google Maps (event_type = 'CLICK_GOOGLE')
    clicks_query = select(func.count(ScanMetric.id)).where(ScanMetric.event_type == "CLICK_GOOGLE")
    clicks_result = await db.execute(clicks_query)
    total_clicks = clicks_result.scalar() or 0

    # 3. Calificación promedio de satisfacción de clientes
    avg_query = select(func.avg(Feedback.rating))
    avg_result = await db.execute(avg_query)
    average_rating_raw = avg_result.scalar()
    average_rating = round(float(average_rating_raw), 2) if average_rating_raw is not None else None

    # 4. Listado de comentarios/quejas recientes (últimas 10 opiniones)
    feedback_query = select(Feedback).order_by(Feedback.created_at.desc()).limit(10)
    feedback_result = await db.execute(feedback_query)
    recent_feedback = feedback_result.scalars().all()

    return DashboardResponse(
        total_scans=total_scans,
        total_clicks=total_clicks,
        average_rating=average_rating,
        recent_feedback=recent_feedback
    )
