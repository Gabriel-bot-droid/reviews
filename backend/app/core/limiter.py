from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.config import settings

# Inicializar el limitador de peticiones (slowapi) usando la dirección IP como clave.
# Se configura storage_uri apuntando al REDIS_URL para compartir los límites entre 
# múltiples instancias del backend, garantizando escalabilidad y evitando evasiones de límites.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL
)
