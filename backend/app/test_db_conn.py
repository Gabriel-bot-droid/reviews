import asyncio
import uuid
from sqlalchemy import select, text
from app.core.database import AsyncSessionLocal, get_tenant_db
from app.models.tenant import Tenant
from app.models.user import User
from app.models.location import Location
from app.models.nfc_card import NFCCard
from app.models.feedback import Feedback
from app.models.metric import ScanMetric

async def main():
    print("Iniciando prueba de conexión y RLS...")
    
    # 1. Usar sesión con rol 'superadmin' para insertar los datos semilla (evitando restricciones de RLS)
    async for session in get_tenant_db(role="superadmin"):
        # Limpiar datos viejos de prueba si existen para arrancar limpio
        await session.execute(text("TRUNCATE TABLE scan_metrics, feedbacks, nfc_cards, users, locations, tenants CASCADE;"))
        
        # Crear Tenants de prueba
        tenant_a = Tenant(name="Tenant A")
        tenant_b = Tenant(name="Tenant B")
        session.add_all([tenant_a, tenant_b])
        await session.flush()
        
        # Obtener IDs generados
        id_a = tenant_a.id
        id_b = tenant_b.id
        print(f"Tenants creados: Tenant A ({id_a}), Tenant B ({id_b})")

        # Crear un usuario para cada Tenant
        user_a = User(tenant_id=id_a, email="admin@tenanta.com", password_hash="hash123", role="admin")
        user_b = User(tenant_id=id_b, email="admin@tenantb.com", password_hash="hash123", role="admin")
        session.add_all([user_a, user_b])
        await session.commit()
        print("Usuarios creados para cada Tenant.")

    # 2. Probar RLS para Tenant A (Solo debe ver datos del Tenant A)
    print("\nProbando RLS con sesión restringida a Tenant A...")
    async for session_a in get_tenant_db(tenant_id=id_a, role="admin"):
        result = await session_a.execute(select(User))
        users = result.scalars().all()
        print(f"Usuarios visibles en sesión Tenant A: {[u.email for u in users]}")
        assert len(users) == 1
        assert users[0].email == "admin@tenanta.com"
        print("¡Éxito! RLS filtró correctamente los usuarios y solo mostró el de Tenant A.")

    # 3. Probar RLS para Tenant B (Solo debe ver datos del Tenant B)
    print("\nProbando RLS con sesión restringida a Tenant B...")
    async for session_b in get_tenant_db(tenant_id=id_b, role="admin"):
        result = await session_b.execute(select(User))
        users = result.scalars().all()
        print(f"Usuarios visibles en sesión Tenant B: {[u.email for u in users]}")
        assert len(users) == 1
        assert users[0].email == "admin@tenantb.com"
        print("¡Éxito! RLS filtró correctamente los usuarios y solo mostró el de Tenant B.")

    # 4. Probar RLS para Superadmin (Debe poder saltarse las restricciones RLS y ver todo)
    print("\nProbando acceso global con sesión de Superadmin...")
    async for session_super in get_tenant_db(role="superadmin"):
        result = await session_super.execute(select(User))
        users = result.scalars().all()
        print(f"Usuarios visibles en sesión Superadmin: {[u.email for u in users]}")
        assert len(users) == 2
        print("¡Éxito! El súper administrador pudo saltarse RLS y ver todos los usuarios.")

    print("\n¡Prueba de conexión y políticas RLS completada con 100% de éxito!")

    from app.commands.create_superadmin import create_superadmin
    await create_superadmin()

if __name__ == "__main__":
    asyncio.run(main())
