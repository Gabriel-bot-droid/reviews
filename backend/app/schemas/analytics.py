from pydantic import BaseModel, Field
from typing import List

class AnalyticsSummary(BaseModel):
    """
    Métricas cuantitativas clave consolidadas en el panel.
    """
    total_scans: int = Field(..., description="Escaneos totales registrados")
    total_redirects_google: int = Field(..., description="Redirecciones totales a Google Maps")
    total_internal_feedbacks: int = Field(..., description="Opiniones internas recolectadas")
    gating_efficiency_percentage: float = Field(..., description="Porcentaje de eficiencia del embudo de redirección")

class RatingsDistribution(BaseModel):
    """
    Distribución de las valoraciones de 1 a 5 estrellas.
    """
    stars_1: int = Field(0, serialization_alias="1_star")
    stars_2: int = Field(0, serialization_alias="2_stars")
    stars_3: int = Field(0, serialization_alias="3_stars")
    stars_4: int = Field(0, serialization_alias="4_stars")
    stars_5: int = Field(0, serialization_alias="5_stars")

    class Config:
        populate_by_name = True

class WeeklyActivityItem(BaseModel):
    """
    Métricas de interacción diaria en el intervalo de la última semana.
    """
    date: str = Field(..., description="Fecha del día en formato YYYY-MM-DD")
    scans: int = Field(0, description="Escaneos de ese día")
    google_clicks: int = Field(0, description="Redirecciones a Google Maps de ese día")
    internal_feedbacks: int = Field(0, description="Opiniones internas recibidas en ese día")

class AnalyticsResponse(BaseModel):
    """
    Esquema consolidado de respuesta para el panel de analíticas avanzadas.
    """
    summary: AnalyticsSummary
    ratings_distribution: RatingsDistribution
    weekly_activity: List[WeeklyActivityItem]
