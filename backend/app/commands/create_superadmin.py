import asyncio
import os
import sys
from sqlalchemy import select, text, func
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.tenant import Tenant
from app.models.user import User
from app.models.location import Location
from app.models.nfc_card import NFCCard
from app.models.feedback import Feedback
from app.models.metric import ScanMetric

from dotenv import load_dotenv
load_dotenv()

async def create_superadmin():
    email = os.getenv("SUPERADMIN_EMAIL", "superadmin@plataforma.com")
    password = os.getenv("SUPERADMIN_PASSWORD", "superadmin_password_segura")

    if not email or not password:
        print("ERROR: Las variables de entorno SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD no están definidas.")
        sys.exit(1)

    print(f"Buscando si el súper administrador con correo '{email}' ya existe...")

    async with AsyncSessionLocal() as session:
        # Seteamos el rol temporalmente como superadmin para poder consultar la base de datos sin RLS
        await session.execute(
            text("SELECT set_config('app.current_user_role', 'superadmin', true)")
        )

        clean_email = email.strip().lower()
        result = await session.execute(select(User).where(func.lower(User.email) == clean_email))
        user = result.scalars().first()

        if user:
            print(f"El usuario súper administrador con correo '{email}' ya existe. Saltando creación.")
            return

        print("Cifrando contraseña e insertando registro...")
        hashed_password = get_password_hash(password)
        
        # El súper administrador no pertenece a ningún tenant B2B (tenant_id = None)
        new_superadmin = User(
            tenant_id=None,
            email=email.strip().lower(),
            password_hash=hashed_password,
            role="superadmin"
        )
        session.add(new_superadmin)
        await session.commit()
        print(f"¡Súper administrador '{email}' creado exitosamente en la base de datos!")

if __name__ == "__main__":
    # Soporte para ejecutar en Windows con loop de asyncio
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(create_superadmin())
