import redis.asyncio as aioredis
from app.core.config import settings

# Inicializar el cliente asíncrono de Redis leyendo la URL de configuración
# decode_responses=True decodifica automáticamente las respuestas binarias de Redis a strings
redis_client = aioredis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True
)

async def get_redis() -> aioredis.Redis:
    """
    Dependencia inyectable para obtener el cliente asíncrono de Redis en los endpoints.
    """
    return redis_client
