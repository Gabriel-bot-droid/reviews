from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.api.deps import get_db_session, get_current_user
from app.models.user import User
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackHistoryResponse, FeedbackResponse

router = APIRouter()

@router.get("", response_model=FeedbackHistoryResponse)
async def get_feedback_history(
    page: int = Query(1, ge=1, description="Número de página"),
    limit: int = Query(10, ge=1, le=100, description="Cantidad de ítems por página"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> FeedbackHistoryResponse:
    """
    Recupera el historial de opiniones y comentarios del local asociado al tenant del administrador.
    El aislamiento de los datos se realiza a nivel de base de datos de forma automática por RLS.
    """
    if current_user.role == "superadmin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los súper administradores globales deben consultar opiniones por inquilino individual."
        )

    # Calcular el offset
    offset = (page - 1) * limit

    # Obtener el total de items
    count_query = select(func.count(Feedback.id))
    count_result = await db.execute(count_query)
    total_items = count_result.scalar() or 0

    # Obtener los items paginados
    query = (
        select(Feedback)
        .order_by(Feedback.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    feedbacks = result.scalars().all()

    # Calcular total de páginas
    total_pages = (total_items + limit - 1) // limit if total_items > 0 else 1

    return FeedbackHistoryResponse(
        items=feedbacks,
        total_items=total_items,
        page=page,
        total_pages=total_pages
    )
