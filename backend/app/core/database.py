import uuid
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
from app.core.config import settings

# Crear el motor de base de datos asíncrono
# echo=True registrará todas las consultas SQL ejecutadas en la consola para depuración
engine = create_async_engine(settings.DATABASE_URL, echo=True)

# Factoría de sesiones asíncronas
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Generador básico de sesión de base de datos asíncrona.
    No define variables de contexto RLS (útil para migración de datos o llamadas anónimas genéricas).
    """
    async with AsyncSessionLocal() as session:
        yield session

async def get_tenant_db(
    tenant_id: Optional[uuid.UUID] = None, 
    role: Optional[str] = None
) -> AsyncGenerator[AsyncSession, None]:
    """
    Generador de sesión de base de datos que inyecta variables de sesión local
    (app.current_user_role y app.current_tenant_id) en PostgreSQL para obligar
    la aplicación de Row-Level Security (RLS) en la transacción actual.
    """
    async with AsyncSessionLocal() as session:
        # Configurar el rol si existe en el JWT
        if role:
            await session.execute(
                text("SELECT set_config('app.current_user_role', :role, true)"),
                {"role": role}
            )
        
        # Configurar el tenant_id si existe y el rol no es súper administrador
        if tenant_id and role != "superadmin":
            await session.execute(
                text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                {"tenant_id": str(tenant_id)}
            )
        
        yield session
