import json
import uuid
from typing import Optional, Dict, Any, List
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.models.location import Location
from app.models.tenant import Tenant
from app.models.nfc_card import NFCCard

class ResolverService:
    """
    Servicio encargado de resolver códigos cortos NFC/QR en branding visual
    utilizando almacenamiento en caché (Redis) para lograr tiempos de respuesta sub-2ms.
    """

    @staticmethod
    async def resolve_short_code(
        db: AsyncSession, 
        redis_conn: aioredis.Redis, 
        short_code: str
    ) -> Optional[Dict[str, Any]]:
        """
        Resuelve un código NFC corto en datos visuales y de redirección del local.
        Aplica estrategia Cache-Aside con TTL de 24 horas.
        """
        redis_key = f"nfc:{short_code}"
        
        # 1. Intentar obtener de la caché (Redis)
        try:
            cached_data = await redis_conn.get(redis_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            # Tolerancia a fallos: si Redis falla, logueamos y seguimos a PostgreSQL
            print(f"Error al consultar caché en Redis: {e}")
            
        # 2. Cache Miss: Consultar PostgreSQL
        # Como es un endpoint público e interactúa un cliente anónimo sin token JWT,
        # configuramos la transacción como 'superadmin' temporalmente para saltar RLS.
        await db.execute(
            text("SELECT set_config('app.current_user_role', 'superadmin', true)")
        )
        
        query = (
            select(Location, Tenant)
            .join(NFCCard, NFCCard.location_id == Location.id)
            .join(Tenant, Tenant.id == Location.tenant_id)
            .where(NFCCard.short_code == short_code)
        )
        
        result = await db.execute(query)
        row = result.first()
        
        if not row:
            return None
            
        location, tenant = row
        
        # Validar si la organización está suspendida o eliminada
        if not tenant.is_active or tenant.deleted_at is not None:
            return None
            
        # 3. Estructurar la respuesta
        data = {
            "location_id": str(location.id),
            "tenant_id": str(location.tenant_id),
            "name": location.name,
            "logo_url": location.logo_url,
            "primary_color": location.primary_color,
            "secondary_color": location.secondary_color,
            "google_maps_url": location.google_maps_url
        }
        
        # 4. Guardar en caché con TTL de 24 horas (86400 segundos)
        try:
            await redis_conn.set(redis_key, json.dumps(data), ex=86400)
        except Exception as e:
            print(f"Error al guardar en caché en Redis: {e}")
            
        return data

    @staticmethod
    async def invalidate_location_cache(
        db: AsyncSession, 
        redis_conn: aioredis.Redis, 
        location_id: uuid.UUID
    ) -> None:
        """
        Invalida las llaves en caché de todas las tarjetas NFC vinculadas al local.
        Se ejecuta de forma reactiva al modificar las configuraciones visuales del local.
        """
        # Habilitar permisos de consulta para leer las tarjetas asociadas
        await db.execute(
            text("SELECT set_config('app.current_user_role', 'superadmin', true)")
        )
        
        query = select(NFCCard.short_code).where(NFCCard.location_id == location_id)
        result = await db.execute(query)
        short_codes = result.scalars().all()
        
        # Eliminar las llaves de Redis correspondientes
        for code in short_codes:
            redis_key = f"nfc:{code}"
            try:
                await redis_conn.delete(redis_key)
                print(f"Caché invalidada para código: {code}")
            except Exception as e:
                print(f"Error al invalidar caché de Redis para {code}: {e}")

    @staticmethod
    async def invalidate_tenant_cache(
        db: AsyncSession, 
        redis_conn: aioredis.Redis, 
        tenant_id: uuid.UUID
    ) -> None:
        """
        Invalida las llaves en caché de todas las tarjetas NFC vinculadas a un Tenant.
        Se ejecuta de forma reactiva al desactivar o eliminar un Tenant.
        """
        # Habilitar permisos de consulta para leer las tarjetas asociadas
        await db.execute(
            text("SELECT set_config('app.current_user_role', 'superadmin', true)")
        )
        
        query = select(NFCCard.short_code).where(NFCCard.tenant_id == tenant_id)
        result = await db.execute(query)
        short_codes = result.scalars().all()
        
        # Eliminar las llaves de Redis correspondientes
        for code in short_codes:
            redis_key = f"nfc:{code}"
            try:
                await redis_conn.delete(redis_key)
                print(f"Caché invalidada para código de Tenant: {code}")
            except Exception as e:
                print(f"Error al invalidar caché de Redis para {code}: {e}")
