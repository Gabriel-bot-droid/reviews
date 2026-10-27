import asyncio
import uuid
import httpx
from sqlalchemy import select, text

from app.models.tenant import Tenant
from app.models.user import User
from app.models.location import Location
from app.models.nfc_card import NFCCard
from app.main import app
from app.core.database import get_tenant_db
from app.core.security import get_password_hash
from app.core.redis import redis_client

async def setup_superadmin_db():
    """
    Limpia y prepara la base de datos con un súper administrador global de prueba.
    """
    print("\n--- [Prueba Superadmin] Inicializando Base de Datos ---")
    super_email = "super@plataforma.com"
    super_password = "password_super_secreto"
    hashed_password = get_password_hash(super_password)
    
    # Usuario normal para pruebas de permisos (role='admin')
    normal_email = "gerente@bellavista.com"
    normal_password = "password_normal"
    hashed_normal_password = get_password_hash(normal_password)

    async for session in get_tenant_db(role="superadmin"):
        # Truncar las tablas con CASCADE
        await session.execute(
            text("TRUNCATE TABLE scan_metrics, feedbacks, nfc_cards, users, locations, tenants CASCADE;")
        )
        
        # 1. Crear un Tenant de prueba base (para pruebas de suspensión)
        tenant_base = Tenant(name="Negocio Inicial", is_active=True)
        session.add(tenant_base)
        await session.flush()

        # 2. Crear local para el Tenant base
        loc_base = Location(
            tenant_id=tenant_base.id,
            name="Negocio Inicial Centro",
            google_maps_url="https://maps.google.com/?cid=111",
            primary_color="#111111",
            secondary_color="#222222"
        )
        session.add(loc_base)
        await session.flush()

        # 3. Crear Tarjeta NFC vinculada al Negocio Inicial
        nfc_base = NFCCard(
            location_id=loc_base.id,
            tenant_id=tenant_base.id,
            short_code="nfcbase"
        )
        session.add(nfc_base)

        # 4. Crear un Súper Administrador
        # El súper admin pertenece al tenant_base solo por referencia de FK (obligatoria),
        # pero su rol define su control global.
        superadmin = User(
            tenant_id=None,
            email=super_email,
            password_hash=hashed_password,
            role="superadmin"
        )
        session.add(superadmin)

        # 5. Crear un Administrador normal
        normal_admin = User(
            tenant_id=tenant_base.id,
            email=normal_email,
            password_hash=hashed_normal_password,
            role="admin"
        )
        session.add(normal_admin)
        
        await session.commit()
        print("Súper administrador y administradores creados exitosamente.")
        return tenant_base.id

async def run_superadmin_tests(tenant_base_id: uuid.UUID):
    print("\n--- [Prueba Superadmin] Iniciando Suite de Endpoints ---")
    await redis_client.flushdb()  # Resetear caché
    
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # ----------------------------------------------------
        # 1. Autenticación del Súper Administrador
        # ----------------------------------------------------
        print("\n1. Iniciando sesión como Súper Administrador...")
        super_login = await client.post(
            "/v1/auth/login",
            json={"email": "super@plataforma.com", "password": "password_super_secreto"}
        )
        assert super_login.status_code == 200, f"Error en login: {super_login.text}"
        super_token = super_login.json()["access_token"]
        super_headers = {"Authorization": f"Bearer {super_token}"}
        print("Login exitoso. Token de Superadmin obtenido.")

        # ----------------------------------------------------
        # 2. Autenticación del Administrador Normal (Control de Permisos)
        # ----------------------------------------------------
        print("\n2. Iniciando sesión como Administrador Normal...")
        normal_login = await client.post(
            "/v1/auth/login",
            json={"email": "gerente@bellavista.com", "password": "password_normal"}
        )
        assert normal_login.status_code == 200
        normal_token = normal_login.json()["access_token"]
        normal_headers = {"Authorization": f"Bearer {normal_token}"}
        print("Login exitoso. Token de Administrador Normal obtenido.")

        # ----------------------------------------------------
        # 3. Denegación de Acceso a No-Superadmin (Seguridad)
        # ----------------------------------------------------
        print("\n3. Verificando que un Administrador Normal no pueda aprovisionar...")
        bad_provision = await client.post(
            "/v1/superadmin/tenants",
            json={"name": "Intento Intruso", "email": "hacker@email.com"},
            headers=normal_headers
        )
        assert bad_provision.status_code == 403, f"Se debió denegar el acceso: {bad_provision.status_code}"
        print("¡Éxito! Retornó 403 Forbidden como se esperaba.")

        # ----------------------------------------------------
        # 4. Aprovisionamiento Exitoso de un Nuevo Tenant (Superadmin)
        # ----------------------------------------------------
        print("\n4. Aprovisionando un nuevo Tenant de prueba...")
        provision_payload = {
            "name": "Pizzería Nápoles",
            "email": "contacto@napoles.com",
            "short_code": "napolesnfc",
            "google_maps_url": "https://maps.google.com/napoles"
        }
        provision_res = await client.post(
            "/v1/superadmin/tenants",
            json=provision_payload,
            headers=super_headers
        )
        assert provision_res.status_code == 201, f"Error al aprovisionar: {provision_res.text}"
        data = provision_res.json()
        new_tenant_id = uuid.UUID(data["tenant_id"])
        new_short_code = data["short_code"]
        print(f"¡Éxito! Tenant creado:")
        print(f"  - Tenant ID: {new_tenant_id}")
        print(f"  - Contraseña Temporal: {data['temporary_password']}")
        print(f"  - Código NFC: {new_short_code}")

        # ----------------------------------------------------
        # 5. Intentar crear con el mismo Email (Debe fallar)
        # ----------------------------------------------------
        print("\n5. Validando prevención de emails duplicados...")
        dup_res = await client.post(
            "/v1/superadmin/tenants",
            json={"name": "Duplicado", "email": "contacto@napoles.com"},
            headers=super_headers
        )
        assert dup_res.status_code == 400, f"Debió fallar por duplicidad: {dup_res.status_code}"
        print("¡Éxito! Retornó 400 Bad Request correctamente.")

        # ----------------------------------------------------
        # 6. Intentar crear con el mismo short_code NFC (Debe fallar)
        # ----------------------------------------------------
        print("\n6. Validando prevención de códigos NFC duplicados...")
        dup_code = await client.post(
            "/v1/superadmin/tenants",
            json={"name": "Duplicado Code", "email": "otro@napoles.com", "short_code": "napolesnfc"},
            headers=super_headers
        )
        assert dup_code.status_code == 400
        print("¡Éxito! Retornó 400 Bad Request por short_code duplicado.")

        # ----------------------------------------------------
        # 7. Resolución Pública del Nuevo Código (Comensal)
        # ----------------------------------------------------
        print("\n7. Validando resolución pública del nuevo código...")
        # Primer llamado (Cache Miss -> va a DB)
        resolve_1 = await client.get(f"/v1/resolver/{new_short_code}")
        assert resolve_1.status_code == 200
        assert resolve_1.json()["name"] == "Pizzería Nápoles"
        
        # Verificar que se cacheó en Redis
        cached_val = await redis_client.get(f"nfc:{new_short_code}")
        assert cached_val is not None, "El código corto debió ser cacheado en Redis."
        print("¡Éxito! Resuelto y cacheado correctamente.")

        # ----------------------------------------------------
        # 7.5. Listar Tenants (Superadmin)
        # ----------------------------------------------------
        print("\n7.5. Probando listado global de Tenants (Superadmin)...")
        list_res = await client.get(
            "/v1/superadmin/tenants?page=1&limit=10",
            headers=super_headers
        )
        assert list_res.status_code == 200, f"Error al listar: {list_res.text}"
        list_data = list_res.json()
        assert list_data["total"] >= 2  # Negocio Inicial y Pizzería Nápoles
        # Verificar que venga el email de admin, el short_code y la URL de Maps
        item_napoles = next(item for item in list_data["items"] if item["name"] == "Pizzería Nápoles")
        assert item_napoles["admin_email"] == "contacto@napoles.com"
        assert item_napoles["short_code"] == "napolesnfc"
        assert item_napoles["google_maps_url"] == "https://maps.google.com/napoles"
        print("¡Éxito! El listado global de tenants se recuperó con datos agregados correctos.")

        # ----------------------------------------------------
        # 7.6. Editar Localización (Superadmin)
        # ----------------------------------------------------
        print("\n7.6. Probando edición de nombre comercial y Google Maps (Superadmin)...")
        edit_loc_payload = {
            "name": "Pizzería Nápoles VIP",
            "google_maps_url": "https://maps.google.com/napoles-vip"
        }
        edit_loc_res = await client.put(
            f"/v1/superadmin/tenants/{new_tenant_id}/location",
            json=edit_loc_payload,
            headers=super_headers
        )
        assert edit_loc_res.status_code == 200, f"Error al editar local: {edit_loc_res.text}"
        edit_data = edit_loc_res.json()
        assert edit_data["name"] == "Pizzería Nápoles VIP"
        assert edit_data["google_maps_url"] == "https://maps.google.com/napoles-vip"
        
        # Validar resolución con nuevos datos e invalidación de caché
        resolve_updated = await client.get(f"/v1/resolver/{new_short_code}")
        assert resolve_updated.status_code == 200
        assert resolve_updated.json()["name"] == "Pizzería Nápoles VIP"
        print("¡Éxito! El súper administrador editó los datos y la caché se actualizó correctamente.")

        # ----------------------------------------------------
        # 8. Suspensión de la cuenta del Tenant (Superadmin)
        # ----------------------------------------------------
        print("\n8. Probando suspensión del Tenant por impago...")
        suspend_res = await client.put(
            f"/v1/superadmin/tenants/{new_tenant_id}/status",
            json={"is_active": False, "reason": "Falta de pago"},
            headers=super_headers
        )
        assert suspend_res.status_code == 200
        assert suspend_res.json()["is_active"] is False
        print("Tenant suspendido exitosamente en la base de datos.")

        # ----------------------------------------------------
        # 9. Comprobar Invalidation de Caché y Pantalla de Suspensión
        # ----------------------------------------------------
        print("\n9. Verificando que la resolución de código se bloquee de inmediato...")
        # El caché en Redis debió eliminarse
        cached_val_post = await redis_client.get(f"nfc:{new_short_code}")
        assert cached_val_post is None, "La caché debió ser invalidada tras suspender al Tenant."
        
        # Intentar resolver (debe retornar 404 / SUSPENDED según lógica)
        resolve_sus = await client.get(f"/v1/resolver/{new_short_code}")
        assert resolve_sus.status_code == 404, f"Se debió bloquear la resolución. Status: {resolve_sus.status_code}"
        print("¡Éxito! La caché fue eliminada y la redirección NFC se bloqueó de inmediato.")

        # ----------------------------------------------------
        # 10. Reactivación y Validación de Retorno
        # ----------------------------------------------------
        print("\n10. Reactivando el Tenant...")
        activate_res = await client.put(
            f"/v1/superadmin/tenants/{new_tenant_id}/status",
            json={"is_active": True},
            headers=super_headers
        )
        assert activate_res.status_code == 200
        assert activate_res.json()["is_active"] is True
        
        # Debe poder resolverse de nuevo
        resolve_act = await client.get(f"/v1/resolver/{new_short_code}")
        assert resolve_act.status_code == 200
        assert resolve_act.json()["name"] == "Pizzería Nápoles VIP"
        print("¡Éxito! El Tenant se reactivó y la redirección volvió a estar en línea.")

        # ----------------------------------------------------
        # 11. Restablecimiento de Contraseña Asistido (Superadmin)
        # ----------------------------------------------------
        print("\n11. Probando restablecimiento de contraseña asistido...")
        reset_res = await client.post(
            f"/v1/superadmin/tenants/{new_tenant_id}/reset-password",
            headers=super_headers
        )
        assert reset_res.status_code == 200, f"Error al restablecer contraseña: {reset_res.text}"
        reset_data = reset_res.json()
        assert "temporary_password" in reset_data
        new_temp_pass = reset_data["temporary_password"]
        print(f"¡Éxito! Contraseña restablecida: {new_temp_pass}")
        
        # Validar login con la nueva contraseña temporal
        login_res = await client.post(
            "/v1/auth/login",
            json={"email": "contacto@napoles.com", "password": new_temp_pass}
        )
        assert login_res.status_code == 200
        # Validar que el token devuelto tenga el claim de cambio de clave requerido
        token_data = login_res.json()
        from app.core.security import jwt, ALGORITHM, settings
        decoded = jwt.decode(token_data["access_token"], settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        assert decoded["requires_password_change"] is True, "El usuario debió quedar marcado con cambio obligatorio."
        print("¡Éxito! Nueva contraseña temporal validada con redirección de seguridad obligatoria.")

async def main():
    tenant_base_id = await setup_superadmin_db()
    await run_superadmin_tests(tenant_base_id)
    print("\n¡Suite de pruebas del Súper Administrador completada con 100% de éxito!")

    from app.commands.create_superadmin import create_superadmin
    await create_superadmin()

if __name__ == "__main__":
    asyncio.run(main())
