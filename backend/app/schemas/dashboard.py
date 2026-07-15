from typing import List, Optional
from pydantic import BaseModel
from app.schemas.feedback import FeedbackResponse

class DashboardResponse(BaseModel):
    """
    Esquema para consolidar las métricas analíticas agregadas del panel de administración
    y la lista de opiniones recientes recopiladas.
    """
    total_scans: int
    total_clicks: int
    average_rating: Optional[float] = None
    recent_feedback: List[FeedbackResponse] = []
