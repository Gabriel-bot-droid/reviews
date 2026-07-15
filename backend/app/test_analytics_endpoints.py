import asyncio
import uuid
import httpx
from datetime import datetime, timezone
from sqlalchemy import text

# Modelos
from app.models.tenant import Tenant
from app.models.user import User
from app.models.location import Location
from app.models.nfc_card import NFCCard
from app.models.feedback import Feedback
from app.models.metric import ScanMetric

# App
from app.main import app
from app.core.database import get_tenant_db
from app.core.security import get_password_hash
from app.core.redis import redis_client

async def setup_test_db():
    print("\n--- 1. Preparando base de datos para analíticas ---")
    test_email = "gerente@bellavista.com"
    test_password = "password123"
    hashed_password = get_password_hash(test_password)
    
    async for session in get_tenant_db(role="superadmin"):
        # Truncar todas las tablas
        await session.execute(
            text("TRUNCATE TABLE scan_metrics, feedbacks, nfc_cards, users, locations, tenants CASCADE;")
        )
        
        tenant = Tenant(name="Restaurante Bella Vista", is_active=True)
        session.add(tenant)
        await session.flush()
        
        location = Location(
            tenant_id=tenant.id,
            name="Bella Vista Centro",
            google_maps_url="https://maps.google.com/?cid=123"
        )
        session.add(location)
        await session.flush()
        
        user = User(
            tenant_id=tenant.id,
            email=test_email,
            password_hash=hashed_password,
            role="admin"
        )
        session.add(user)
        
        nfc_card = NFCCard(
            location_id=location.id,
            tenant_id=tenant.id,
            short_code="bellanfc"
        )
        session.add(nfc_card)
        await session.commit()
        return location.id, tenant.id

async def run_tests():
    location_id, tenant_id = await setup_test_db()
    
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Autenticar Administrador
        login_res = await client.post(
            "/v1/auth/login",
            json={"email": "gerente@bellavista.com", "password": "password123"}
        )
        assert login_res.status_code == 200, f"Login fallido: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("¡Éxito! Token de acceso administrativo obtenido.")
        
        # 2. Limpiar Redis
        await redis_client.flushdb()
        
        # 3. Registrar eventos cuantitativos públicos (con y sin rating asociado)
        print("\n[Métricas] Insertando eventos de escaneo y clics...")
        # 2 Escaneos
        scan1 = await client.post("/v1/resolver/bellanfc/metric", json={"event_type": "SCAN"})
        assert scan1.status_code == 200
        scan2 = await client.post("/v1/resolver/bellanfc/metric", json={"event_type": "SCAN"})
        assert scan2.status_code == 200

        # 1 Clic a Google con 5 estrellas (Redirección positiva)
        click1 = await client.post("/v1/resolver/bellanfc/metric", json={"event_type": "CLICK_GOOGLE", "rating": 5})
        assert click1.status_code == 200

        # 1 Clic a Google con 2 estrellas (Fuga del embudo)
        click2 = await client.post("/v1/resolver/bellanfc/metric", json={"event_type": "CLICK_GOOGLE", "rating": 2})
        assert click2.status_code == 200
        
        # 4. Enviar opiniones (Feedback)
        print("\n[Feedback] Insertando valoraciones de 1, 3 y 5 estrellas...")
        # 5 estrellas (sin comentario)
        fb1 = await client.post("/v1/resolver/bellanfc/feedback", json={"rating": 5})
        assert fb1.status_code == 200
        
        # 3 estrellas (con comentario)
        fb2 = await client.post("/v1/resolver/bellanfc/feedback", json={"rating": 3, "comment": "Servicio promedio, aceptable."})
        assert fb2.status_code == 200

        # 1 estrella (con comentario)
        fb3 = await client.post("/v1/resolver/bellanfc/feedback", json={"rating": 1, "comment": "Pésima atención, comida fría."})
        assert fb3.status_code == 200

        # 5. Probar paginación del historial de opiniones
        print("\n[Historial] Probando paginación de opiniones...")
        # Página 1 con límite 2 (Debería retornar 2 ítems de los 3 totales)
        hist1 = await client.get("/v1/admin/feedback?page=1&limit=2", headers=headers)
        assert hist1.status_code == 200, hist1.text
        data1 = hist1.json()
        assert len(data1["items"]) == 2
        assert data1["total_items"] == 3
        assert data1["total_pages"] == 2
        assert data1["page"] == 1

        # Página 2 con límite 2 (Debería retornar el ítem restante)
        hist2 = await client.get("/v1/admin/feedback?page=2&limit=2", headers=headers)
        assert hist2.status_code == 200, hist2.text
        data2 = hist2.json()
        assert len(data2["items"]) == 1
        assert data2["total_items"] == 3
        assert data2["page"] == 2
        print("¡Éxito! Paginación de opiniones y conteo de páginas validados.")

        # 6. Probar endpoint de analíticas
        print("\n[Analíticas] Probando consolidación de estadísticas...")
        an_res = await client.get("/v1/admin/analytics", headers=headers)
        assert an_res.status_code == 200, an_res.text
        an_data = an_res.json()
        
        # Validar Resumen (Summary)
        summary = an_data["summary"]
        assert summary["total_scans"] == 2
        assert summary["total_redirects_google"] == 2
        assert summary["total_internal_feedbacks"] == 3
        assert summary["gating_efficiency_percentage"] == 100.0  # (2 clics / 2 escaneos) * 100
        
        # Validar Distribución de Calificaciones
        dist = an_data["ratings_distribution"]
        assert dist["1_star"] == 1
        assert dist["2_stars"] == 0
        assert dist["3_stars"] == 1
        assert dist["4_stars"] == 0
        assert dist["5_stars"] == 1
        
        # Validar Actividad Semanal
        activity = an_data["weekly_activity"]
        assert len(activity) == 7  # 7 días
        today_activity = activity[-1]  # El día de hoy
        assert today_activity["scans"] == 2
        assert today_activity["google_clicks"] == 2
        assert today_activity["internal_feedbacks"] == 3
        print("¡Éxito! Resumen de analíticas, distribución de estrellas y actividad diaria verificados.")

if __name__ == "__main__":
    asyncio.run(run_tests())
