import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

# Importar configuración y metadatos del modelo
from app.core.config import settings
from app.models.base import Base
# Importar todos los modelos para asegurar que se registren en Base.metadata
from app.models.tenant import Tenant
from app.models.user import User
from app.models.location import Location
from app.models.nfc_card import NFCCard
from app.models.feedback import Feedback
from app.models.metric import ScanMetric

# Objeto de configuración de Alembic
config = context.config

# Configurar el sistema de logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Asignar los metadatos de nuestros modelos
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Ejecuta las migraciones en modo 'offline'."""
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    """Función síncrona interna para ejecutar las migraciones utilizando una conexión."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
    )

    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online() -> None:
    """Ejecuta las migraciones en modo 'online' (asíncrona)."""
    # Crear el motor asíncrono leyendo la URL del archivo .env
    connectable = create_async_engine(
        settings.DATABASE_URL,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        # Ejecutar la migración utilizando el helper run_sync de SQLAlchemy
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    # Correr el bucle asíncrono para la ejecución online
    asyncio.run(run_migrations_online())
