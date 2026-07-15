from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1.api import api_router
from app.core.config import settings

from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.core.limiter import limiter

# Inicializar la aplicación FastAPI con metadata descriptiva
app = FastAPI(
    title="QuickFeedback NFC API",
    description="Backend API REST para la gestión dinámica de redirección de reseñas e interceptación de feedback.",
    version="1.0.0",
)

# Integrar el limitador de tasa y su manejador de respuestas de error (429 Too Many Requests)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Servir archivos estáticos localmente (para los logotipos subidos por los administradores)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Configuración de middleware CORS (Cross-Origin Resource Sharing)
# Permite conectar de forma segura el frontend Next.js configurado en las variables de entorno
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar el enrutador de la API con el prefijo /v1
app.include_router(api_router, prefix="/v1")

@app.get("/", tags=["root"])
async def root():
    """
    Ruta raíz para verificar que la API está operativa de forma rápida.
    """
    return {
        "status": "healthy",
        "service": "QuickFeedback NFC API",
        "documentation": "/docs"
    }
