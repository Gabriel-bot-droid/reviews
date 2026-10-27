import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, text
from fastapi import HTTPException, Request

# Importar componentes de la aplicación
from app.core.database import AsyncSessionLocal, get_tenant_db
from app.core.security import get_password_hash, verify_password, ALGORITHM
from app.models.tenant import Tenant
from app.models.user import User
from app.models.location import Location
from app.models.nfc_card import NFCCard
from app.models.feedback import Feedback
from app.models.metric import ScanMetric
from app.schemas.auth import LoginRequest
from app.api.v1.endpoints.auth import login
from app.api.deps import get_current_user
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt
from app.core.config import settings

async def main():
    print("Iniciando pruebas de flujo de autenticación y seguridad...")

    # Configuración de credenciales de prueba
    test_email = "gerente@bellavista.com"
    test_password = "mi_secure_password"
    hashed_password = get_password_hash(test_password)
    
    # 1. Preparar la base de datos con un Tenant y un Usuario de prueba
    async for session in get_tenant_db(role="superadmin"):
        # Limpiar base de datos
        await session.execute(text("TRUNCATE TABLE scan_metrics, feedbacks, nfc_cards, users, locations, tenants CASCADE;"))
        
        # Crear Tenant activo
        tenant = Tenant(name="Restaurante Bella Vista", is_active=True)
        session.add(tenant)
        await session.flush()
        
        tenant_id = tenant.id
        
        # Crear Usuario admin para ese Tenant con la contraseña cifrada
        user = User(
            tenant_id=tenant_id, 
            email=test_email, 
            password_hash=hashed_password, 
            role="admin"
        )
        session.add(user)
        await session.commit()
        print(f"Base de datos preparada: Tenant ({tenant_id}) y Usuario ({user.id}) creados.")

    # 2. Probar verificación de contraseña en texto plano vs hash
    print("\n[Prueba 1] Verificación de hash de contraseña...")
    assert verify_password(test_password, hashed_password) == True
    assert verify_password("incorrect_password", hashed_password) == False
    print("¡Éxito! El hashing con bcrypt y la verificación funcionan correctamente.")

    # 3. Probar el endpoint de Login directamente con credenciales válidas e inválidas
    print("\n[Prueba 2] Probar endpoint de login...")
    async for session in get_tenant_db():
        # Login exitoso
        req_valido = LoginRequest(email=test_email, password=test_password)
        resp = await login(credentials=req_valido, db=session)
        print(f"Login exitoso. Token generado: {resp.access_token[:30]}...")
        assert resp.token_type == "bearer"
        assert resp.expires_in == settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        
        # Guardar token para probar la autenticación posterior
        token = resp.access_token

        # Login fallido (contraseña incorrecta)
        req_invalido = LoginRequest(email=test_email, password="wrongpassword")
        try:
            await login(credentials=req_invalido, db=session)
            raise AssertionError("El login debió fallar por contraseña incorrecta.")
        except HTTPException as e:
            assert e.status_code == 401
            print("¡Éxito! Contraseña incorrecta rechazada con 401 Unauthorized.")

    # 4. Probar la dependencia get_current_user decodificando y validando el token
    print("\n[Prueba 3] Validación de JWT y extracción de usuario...")
    async for session in get_tenant_db():
        # Crear la estructura de credenciales que espera FastAPI Security (HTTPBearer)
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        
        # Invocar la dependencia get_current_user
        dummy_request = Request(scope={"type": "http", "path": "/v1/admin/location", "method": "GET"})
        current_user = await get_current_user(request=dummy_request, http_auth=credentials, db=session)
        print(f"Usuario autenticado por JWT: {current_user.email} (Rol: {current_user.role})")
        assert current_user.email == test_email
        assert current_user.tenant_id == tenant_id
        print("¡Éxito! El token JWT fue decodificado y el usuario fue validado correctamente.")

    # 5. Probar comportamiento al desactivar o eliminar al Tenant (Control por impago)
    print("\n[Prueba 4] Verificación de bloqueo por suspensión del Tenant...")
    async for session in get_tenant_db(role="superadmin"):
        # Desactivar tenant
        result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
        db_tenant = result.scalars().first()
        db_tenant.is_active = False
        await session.commit()
        print(f"Tenant desactivado (is_active = False).")

    async for session in get_tenant_db():
        # Intentar login con tenant suspendido
        req_valido = LoginRequest(email=test_email, password=test_password)
        try:
            await login(credentials=req_valido, db=session)
            raise AssertionError("El login debió fallar por tenant inactivo.")
        except HTTPException as e:
            assert e.status_code == 403
            assert "suspendida" in e.detail
            print("¡Éxito! El login fue rechazado con 403 Forbidden debido a tenant inactivo.")

    # 6. Probar comportamiento al borrar lógicamente (Soft Delete) al Tenant
    print("\n[Prueba 5] Verificación de bloqueo por borrado lógico (Soft Delete) del Tenant...")
    async for session in get_tenant_db(role="superadmin"):
        # Activar de nuevo pero marcar como eliminado
        result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
        db_tenant = result.scalars().first()
        db_tenant.is_active = True
        db_tenant.deleted_at = datetime.now(timezone.utc)
        await session.commit()
        print(f"Tenant marcado como eliminado (deleted_at = timestamp).")

    async for session in get_tenant_db():
        # Intentar login con tenant borrado lógicamente
        req_valido = LoginRequest(email=test_email, password=test_password)
        try:
            await login(credentials=req_valido, db=session)
            raise AssertionError("El login debió fallar por tenant eliminado.")
        except HTTPException as e:
            assert e.status_code == 403
            assert "suspendida" in e.detail or "eliminado" in e.detail
            print("¡Éxito! El login fue rechazado con 403 Forbidden debido a tenant eliminado.")

    print("\n¡Todas las pruebas de flujo de autenticación y seguridad pasaron con 100% de éxito!")

    from app.commands.create_superadmin import create_superadmin
    await create_superadmin()

if __name__ == "__main__":
    asyncio.run(main())
