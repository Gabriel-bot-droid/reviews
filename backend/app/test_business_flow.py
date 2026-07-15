import asyncio
import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import select, text
import httpx

# Registrar todos los modelos en SQLAlchemy
from app.models.tenant import Tenant
from app.models.user import User
from app.models.location import Location
from app.models.nfc_card import NFCCard
from app.models.feedback import Feedback
from app.models.metric import ScanMetric

# Importar aplicación y configuraciones
from app.main import app
from app.core.database import get_tenant_db
from app.core.security import get_password_hash
from app.core.redis import redis_client

async def setup_database():
    """
    Limpia y prepara la base de datos con un inquilino de prueba, 
    su local, usuario administrador y tarjeta NFC asociada.
    """
    print("\n--- 1. Preparando base de datos de prueba ---")
    test_email = "admin@bellavista.com"
    test_password = "mi_super_contraseña"
    hashed_password = get_password_hash(test_password)
    
    async for session in get_tenant_db(role="superadmin"):
        # Truncar tablas
        await session.execute(
            text("TRUNCATE TABLE scan_metrics, feedbacks, nfc_cards, users, locations, tenants CASCADE;")
        )
        
        # Crear Tenant
        tenant = Tenant(name="Restaurante Bella Vista", is_active=True)
        session.add(tenant)
        await session.flush()
        
        # Crear Local
        location = Location(
            tenant_id=tenant.id,
            name="Bella Vista Centro",
            primary_color="#004b49",
            secondary_color="#ffffff",
            google_maps_url="https://maps.google.com/?cid=12345"
        )
        session.add(location)
        await session.flush()
        
        # Crear Usuario Administrador
        user = User(
            tenant_id=tenant.id,
            email=test_email,
            password_hash=hashed_password,
            role="admin"
        )
        session.add(user)
        
        # Crear Tarjeta NFC vinculada
        nfc_card = NFCCard(
            location_id=location.id,
            tenant_id=tenant.id,
            short_code="bellanfc"
        )
        session.add(nfc_card)
        
        await session.commit()
        print("Base de datos de prueba inicializada con éxito.")
        return location.id

async def run_api_tests(location_id: uuid.UUID):
    print("\n--- 2. Iniciando pruebas de endpoints mediante httpx.AsyncClient ---")
    # Limpiar Redis para asegurar que iniciamos sin límites de tasa acumulados ni cachés previas
    await redis_client.flushdb()
    
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # --- PRUEBA A: Autenticación de Administrador ---
        print("\n[A] Probando inicio de sesión...")
        login_response = await client.post(
            "/v1/auth/login",
            json={"email": "admin@bellavista.com", "password": "mi_super_contraseña"}
        )
        assert login_response.status_code == 200, f"Login fallido: {login_response.text}"
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("¡Éxito! Token obtenido correctamente.")

        # --- PRUEBA B: Obtener Configuración Visual (Admin) ---
        print("\n[B] Probando consulta de local (Admin)...")
        get_res = await client.get("/v1/admin/location", headers=headers)
        assert get_res.status_code == 200, f"Consulta fallida: {get_res.text}"
        data = get_res.json()
        assert data["name"] == "Bella Vista Centro"
        assert data["primary_color"] == "#004b49"
        print(f"¡Éxito! Local recuperado correctamente: '{data['name']}'")

        # --- PRUEBA C: Actualizar Configuración Visual (Admin) ---
        print("\n[C] Probando actualización de local (Admin)...")
        update_payload = {
            "name": "Bella Vista Centro Renovado",
            "logo_url": "http://example.com/logo.png",
            "primary_color": "#ff5733",
            "secondary_color": "#000000",
            "google_maps_url": "https://maps.google.com/?cid=99999"
        }
        put_res = await client.put("/v1/admin/location", headers=headers, json=update_payload)
        assert put_res.status_code == 200, f"Actualización fallida: {put_res.text}"
        assert put_res.json()["name"] == "Bella Vista Centro Renovado"
        print("¡Éxito! Local actualizado.")

        # --- PRUEBA D: Resolución NFC y Caché en Redis (Cache-aside) ---
        print("\n[D] Probando resolución NFC pública...")
        # Asegurar que no hay basura en Redis para esta prueba
        await redis_client.delete("nfc:bellanfc")
        
        # Primera petición: Cache Miss (lee de PostgreSQL y escribe en Redis)
        resolve_res1 = await client.get("/v1/resolver/bellanfc")
        assert resolve_res1.status_code == 200, resolve_res1.text
        assert resolve_res1.json()["name"] == "Bella Vista Centro Renovado"
        print("Primer intento (Cache Miss) - Respuesta correcta.")
        
        # Comprobar que los datos se guardaron efectivamente en Redis
        redis_val = await redis_client.get("nfc:bellanfc")
        assert redis_val is not None, "Error: Redis no almacenó la caché."
        print("Caché guardada en Redis correctamente.")
        
        # Segunda petición: Cache Hit (Lee directo de Redis)
        resolve_res2 = await client.get("/v1/resolver/bellanfc")
        assert resolve_res2.status_code == 200
        assert resolve_res2.json()["primary_color"] == "#ff5733"
        print("Segundo intento (Cache Hit) - Respuesta rápida correcta.")

        # --- PRUEBA E: Registro de métricas cuantitativas ---
        print("\n[E] Probando registro de métricas públicas...")
        metric_res = await client.post("/v1/resolver/bellanfc/metric", json={"event_type": "SCAN"})
        assert metric_res.status_code == 200
        assert metric_res.json() == {"status": "recorded"}
        print("¡Éxito! Métrica de escaneo 'SCAN' registrada.")

        # --- PRUEBA F: Envío de valoraciones (Feedback) ---
        print("\n[F] Probando validaciones de feedback...")
        
        # Calificación baja sin comentario (Debe ser aceptada tras quitar la restricción)
        good_fb_res1 = await client.post("/v1/resolver/bellanfc/feedback", json={"rating": 2, "comment": ""})
        assert good_fb_res1.status_code == 200, f"Error: {good_fb_res1.text}"
        print("¡Éxito! Valoración baja sin comentario aceptada (200) correctamente.")
        
        # Calificación baja con comentario corto (Debe ser aceptada tras quitar la restricción)
        good_fb_res2 = await client.post("/v1/resolver/bellanfc/feedback", json={"rating": 2, "comment": "malo"})
        assert good_fb_res2.status_code == 200, f"Error: {good_fb_res2.text}"
        print("¡Éxito! Valoración baja con comentario corto aceptada (200) correctamente.")
        
        # Calificación con comentario conteniendo tags HTML (Debe ser sanitizada/escapada para prevenir XSS)
        xss_fb_res = await client.post("/v1/resolver/bellanfc/feedback", json={"rating": 1, "comment": "<script>alert('XSS')</script> malo"})
        assert xss_fb_res.status_code == 200, f"Error: {xss_fb_res.text}"
        assert xss_fb_res.json()["comment"] == "&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt; malo"
        print("¡Éxito! Comentario con script HTML sanitizado y escapado correctamente en la respuesta.")

        # --- PRUEBA G: Rate Limiting para Feedback (Max 3/minute) ---
        print("\n[G] Probando Rate Limiting (Máximo 3 feedbacks por minuto)...")
        # Hasta ahora llevamos 3 registros exitosos de feedback en este minuto (comentario vacío, comentario "malo" y comentario XSS)
        # Mandamos el 4to feedback del minuto (debe dar 429 Too Many Requests directamente)
        limit_fb4 = await client.post("/v1/resolver/bellanfc/feedback", json={"rating": 5})
        assert limit_fb4.status_code == 429, f"Debió rechazar por límite: {limit_fb4.status_code} - {limit_fb4.text}"
        print("¡Éxito! El cuarto envío de feedback fue rechazado con 429 Too Many Requests.")

        # --- PRUEBA H: Invalidación de Caché reactiva ---
        print("\n[H] Probando invalidación de caché reactiva ante edición del local...")
        # Aseguramos que la caché exista
        await client.get("/v1/resolver/bellanfc")
        redis_val_before = await redis_client.get("nfc:bellanfc")
        assert redis_val_before is not None
        
        # Actualizar local (esto debería disparar la invalidación del short_code en Redis)
        update_payload2 = {
            "name": "Bella Vista Final",
            "logo_url": "http://example.com/logo2.png",
            "primary_color": "#ffffff",
            "secondary_color": "#000000",
            "google_maps_url": "https://maps.google.com/?cid=11111"
        }
        await client.put("/v1/admin/location", headers=headers, json=update_payload2)
        
        # Comprobar que la llave ya no existe en Redis
        redis_val_after = await redis_client.get("nfc:bellanfc")
        assert redis_val_after is None, "Error: La caché no fue eliminada de Redis tras la actualización."
        print("¡Éxito! La caché en Redis se invalidó automáticamente al editar el local.")
        
        # Nueva consulta para verificar que devuelve los datos nuevos
        final_res = await client.get("/v1/resolver/bellanfc")
        assert final_res.json()["name"] == "Bella Vista Final"
        print("¡Éxito! Resolvedor devolvió los nuevos datos modificados.")

        # --- PRUEBA I: Dashboard de analíticas (Admin) ---
        print("\n[I] Probando consulta del dashboard de analíticas (Admin)...")
        dash_res = await client.get("/v1/admin/dashboard", headers=headers)
        assert dash_res.status_code == 200, dash_res.text
        dash_data = dash_res.json()
        assert dash_data["total_scans"] == 1
        assert dash_data["total_clicks"] == 0
        assert dash_data["average_rating"] == 1.67
        assert len(dash_data["recent_feedback"]) == 3
        print("¡Éxito! Dashboard recuperado con datos analíticos y opiniones correctas.")

        # --- PRUEBA J: Subida de Logotipo (Admin) ---
        print("\n[J] Probando subida de logotipo local (Admin)...")
        # Simular una imagen en bytes
        fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        files = {"file": ("logotipo_test.png", fake_png, "image/png")}
        
        logo_res = await client.post("/v1/admin/location/logo", headers=headers, files=files)
        assert logo_res.status_code == 200, logo_res.text
        logo_data = logo_res.json()
        assert f"/static/uploads/{location_id}.png" in logo_data["logo_url"]
        print("¡Éxito! Logotipo subido, guardado en disco y base de datos actualizada.")

async def main():
    location_id = await setup_database()
    await run_api_tests(location_id)
    print("\n¡Pruebas del flujo de negocio de la Fase 3 completadas con 100% de éxito!")

if __name__ == "__main__":
    asyncio.run(main())
