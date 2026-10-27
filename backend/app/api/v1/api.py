from fastapi import APIRouter
from app.api.v1.endpoints import auth, location, resolver, dashboard, feedback, analytics, superadmin

# Enrutador principal de la API V1
api_router = APIRouter()

# Registrar los endpoints del módulo de autenticación
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Registrar los endpoints de la gestión visual y de branding de locales
api_router.include_router(location.router, prefix="/admin/location", tags=["admin-location"])

# Registrar los endpoints públicos para resolver códigos cortos NFC
api_router.include_router(resolver.router, prefix="/resolver", tags=["resolver"])

# Registrar el endpoint de métricas y opiniones del panel de control
api_router.include_router(dashboard.router, prefix="/admin/dashboard", tags=["admin-dashboard"])

# Registrar el historial paginado de opiniones
api_router.include_router(feedback.router, prefix="/admin/feedback", tags=["admin-feedback"])

# Registrar las analíticas y métricas avanzadas
api_router.include_router(analytics.router, prefix="/admin/analytics", tags=["admin-analytics"])

# Registrar los endpoints de administración global y aprovisionamiento (Superadmin)
api_router.include_router(superadmin.router, prefix="/superadmin", tags=["superadmin"])
