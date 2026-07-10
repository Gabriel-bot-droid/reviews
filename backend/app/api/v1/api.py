from fastapi import APIRouter
from app.api.v1.endpoints import auth

# Enrutador principal de la API V1
api_router = APIRouter()

# Registrar los endpoints del módulo de autenticación
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
