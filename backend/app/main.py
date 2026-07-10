from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router

# Inicializar la aplicación FastAPI con metadata descriptiva
app = FastAPI(
    title="QuickFeedback NFC API",
    description="Backend API REST para la gestión dinámica de redirección de reseñas e interceptación de feedback.",
    version="1.0.0",
)

# Configuración de middleware CORS (Cross-Origin Resource Sharing)
# Permite conectar de forma segura el frontend Next.js en local (puerto 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
