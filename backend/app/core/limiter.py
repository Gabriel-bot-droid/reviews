from fastapi import Request
from slowapi import Limiter
from app.core.config import settings
import logging
import urllib.parse
from redis import Redis

logger = logging.getLogger(__name__)

def get_client_ip(request: Request) -> str:
    """
    Obtiene la dirección IP real del cliente que realiza la petición.
    Si la API está desplegada detrás de un proxy inverso o balanceador de carga
    (Nginx, Cloudflare, etc.), lee el valor original en la cabecera X-Forwarded-For.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Tomar la primera IP de la cadena (el cliente real original)
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

# 1. Verificar de forma segura si Redis está activo
redis_available = False
try:
    parsed = urllib.parse.urlparse(settings.REDIS_URL)
    r = Redis(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        db=int(parsed.path.lstrip("/")) if parsed.path else 0,
        socket_timeout=1.0,
        socket_connect_timeout=1.0
    )
    if r.ping():
        redis_available = True
except Exception as e:
    # Logger configurado para avisar que cae a almacenamiento en memoria local
    print(f"Redis no está disponible en {settings.REDIS_URL} ({e}). Usando storage en memoria para Rate Limiting.")

storage_uri = settings.REDIS_URL if redis_available else "memory://"

# Inicializar el limitador de peticiones (slowapi) usando la función de extracción de IP real.
limiter = Limiter(
    key_func=get_client_ip,
    storage_uri=storage_uri
)
