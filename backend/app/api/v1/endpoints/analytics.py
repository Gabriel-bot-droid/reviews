from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, Date
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone

from app.api.deps import get_db_session, get_current_user
from app.models.user import User
from app.models.feedback import Feedback
from app.models.metric import ScanMetric
from app.schemas.analytics import AnalyticsResponse, AnalyticsSummary, RatingsDistribution, WeeklyActivityItem

router = APIRouter()

@router.get("", response_model=AnalyticsResponse)
async def get_analytics_data(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> AnalyticsResponse:
    """
    Recupera las estadísticas de branding y rendimiento del local asociado al tenant.
    Calcula totales de escaneo, clics y feedbacks, la distribución de estrellas (1-5) 
    y la actividad diaria de los últimos 7 días.
    """
    if current_user.role == "superadmin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los súper administradores globales deben consultar analíticas por inquilino individual."
        )

    # 1. Calcular totales del resumen
    scans_query = select(func.count(ScanMetric.id)).where(ScanMetric.event_type == "SCAN")
    scans_result = await db.execute(scans_query)
    total_scans = scans_result.scalar() or 0

    clicks_query = select(func.count(ScanMetric.id)).where(ScanMetric.event_type == "CLICK_GOOGLE")
    clicks_result = await db.execute(clicks_query)
    total_clicks = clicks_result.scalar() or 0

    feedbacks_count_query = select(func.count(Feedback.id)).where(Feedback.rating <= 3)
    feedbacks_count_result = await db.execute(feedbacks_count_query)
    total_feedbacks = feedbacks_count_result.scalar() or 0

    avg_rating_query = select(func.avg(Feedback.rating))
    avg_result = await db.execute(avg_rating_query)
    raw_avg = avg_result.scalar()
    average_rating = round(float(raw_avg), 1) if raw_avg is not None else 0.0

    summary = AnalyticsSummary(
        total_scans=total_scans,
        total_redirects_google=total_clicks,
        total_internal_feedbacks=total_feedbacks,
        average_rating=average_rating
    )

    # 2. Calcular distribución de estrellas
    dist_query = select(Feedback.rating, func.count(Feedback.id)).group_by(Feedback.rating)
    dist_result = await db.execute(dist_query)
    dist_rows = dist_result.all()

    dist_dict = {
        "1_star": 0,
        "2_stars": 0,
        "3_stars": 0,
        "4_stars": 0,
        "5_stars": 0
    }
    for rating, count in dist_rows:
        if rating == 1:
            dist_dict["1_star"] = count
        elif rating == 2:
            dist_dict["2_stars"] = count
        elif rating == 3:
            dist_dict["3_stars"] = count
        elif rating == 4:
            dist_dict["4_stars"] = count
        elif rating == 5:
            dist_dict["5_stars"] = count

    ratings_dist = RatingsDistribution(
        stars_1=dist_dict["1_star"],
        stars_2=dist_dict["2_stars"],
        stars_3=dist_dict["3_stars"],
        stars_4=dist_dict["4_stars"],
        stars_5=dist_dict["5_stars"]
    )

    # 3. Calcular actividad semanal (últimos 7 días)
    # Fecha de inicio: hace 6 días (incluyendo hoy son 7 días)
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=6)
    start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)

    # Scans y clics agrupados por día en UTC
    scan_query = (
        select(
            func.cast(func.timezone('UTC', ScanMetric.created_at), Date).label("day"),
            ScanMetric.event_type,
            func.count(ScanMetric.id)
        )
        .where(ScanMetric.created_at >= start_datetime)
        .group_by("day", ScanMetric.event_type)
    )
    scan_res = await db.execute(scan_query)
    scan_rows = scan_res.all()

    # Feedbacks (Quejas retenidas 1-3 estrellas) agrupados por día en UTC
    feedback_query = (
        select(
            func.cast(func.timezone('UTC', Feedback.created_at), Date).label("day"),
            func.count(Feedback.id)
        )
        .where((Feedback.created_at >= start_datetime) & (Feedback.rating <= 3))
        .group_by("day")
    )
    feedback_res = await db.execute(feedback_query)
    feedback_rows = feedback_res.all()

    # Consolidar actividad por día en un diccionario
    activity_map = {}
    for i in range(7):
        current_day = start_date + timedelta(days=i)
        activity_map[current_day] = {
            "date": current_day.isoformat(),
            "scans": 0,
            "google_clicks": 0,
            "internal_feedbacks": 0
        }

    for row in scan_rows:
        day_date, event_type, count = row
        if day_date in activity_map:
            if event_type == "SCAN":
                activity_map[day_date]["scans"] = count
            elif event_type == "CLICK_GOOGLE":
                activity_map[day_date]["google_clicks"] = count

    for row in feedback_rows:
        day_date, count = row
        if day_date in activity_map:
            activity_map[day_date]["internal_feedbacks"] = count

    weekly_activity = [
        WeeklyActivityItem(
            date=activity_map[day]["date"],
            scans=activity_map[day]["scans"],
            google_clicks=activity_map[day]["google_clicks"],
            internal_feedbacks=activity_map[day]["internal_feedbacks"]
        )
        for day in sorted(activity_map.keys())
    ]

    return AnalyticsResponse(
        summary=summary,
        ratings_distribution=ratings_dist,
        weekly_activity=weekly_activity
    )
