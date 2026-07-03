# Especificación de la API - QuickFeedback NFC

Este documento define la interfaz de programación de la API REST (Backend en FastAPI) para **QuickFeedback NFC**. Todos los payloads de entrada y salida se formatean en JSON.

---

## 🔑 Autenticación y Seguridad

Los endpoints del panel de administración requieren un token de portador (Bearer Token) en la cabecera HTTP de autorización:

```http
Authorization: Bearer <JWT_TOKEN>
```

El token JWT incluye los siguientes claims en su payload:
*   `sub`: ID del usuario administrador (UUID).
*   `tenant_id`: ID del tenant al que pertenece el usuario (UUID).
*   `role`: Rol del usuario (`admin`, `superadmin`).
*   `exp`: Tiempo de expiración.

---

## 🌐 Endpoints Públicos (Comensal / NFC Scan)

Estos endpoints no requieren autenticación y están optimizados para baja latencia.

### 1. Resolver Código NFC
Resuelve la configuración visual y estado de un local a partir del código corto en el tag NFC.

*   **Ruta:** `GET /v1/resolver/{short_code}`
*   **Parámetros de ruta:**
    *   `short_code` (string): Código de 6-8 caracteres alfanuméricos.
*   **Respuestas:**

    *   **200 OK (Servicio Activo):**
        ```json
        {
          "status": "ACTIVE",
          "location": {
            "name": "Restaurante Bella Vista",
            "logo_url": "https://cdn.midominio.com/logos/bella_vista.png",
            "primary_color": "#FF5733",
            "secondary_color": "#C70039",
            "google_maps_url": "https://maps.google.com/?cid=123456789"
          }
        }
        ```

    *   **200 OK (Servicio Suspendido):**
        ```json
        {
          "status": "SUSPENDED",
          "message": "Servicio temporalmente no disponible. Comuníquese con soporte."
        }
        ```

    *   **404 Not Found (Código inválido o inexistente):**
        ```json
        {
          "detail": "NFC Code not found."
        }
        ```

---

### 2. Registrar Feedback Interno (Calificaciones 1-3)
Envía los comentarios de comensales insatisfechos de forma 100% anónima.

*   **Ruta:** `POST /v1/resolver/{short_code}/feedback`
*   **Rate Limiting:** Máximo 3 peticiones por minuto por dirección IP (implementado con `slowapi`).
*   **Payload de petición:**
    ```json
    {
      "rating": 2,
      "comment": "La comida llegó fría y el mesonero tardó 20 minutos en traernos la cuenta."
    }
    ```
*   **Validaciones:**
    *   `rating`: Entero obligatorio entre 1 y 3 inclusive.
    *   `comment`: String obligatorio de mínimo 10 y máximo 1000 caracteres.
*   **Respuestas:**
    *   **201 Created:**
        ```json
        {
          "success": true,
          "message": "Muchas gracias por tu feedback, nos ayuda a mejorar."
        }
        ```
    *   **400 Bad Request (Validación fallida):**
        ```json
        {
          "detail": "El comentario debe tener al menos 10 caracteres."
        }
        ```
    *   **404 Not Found:** Código NFC inválido.
    *   **429 Too Many Requests (Rate limit excedido):**
        ```json
        {
          "detail": "Rate limit exceeded. Max 3 requests per minute."
        }
        ```

---

### 3. Registrar Métrica (Escaneo o Click a Google)
Registra eventos de forma anónima para construir estadísticas en el dashboard del local.

*   **Ruta:** `POST /v1/resolver/{short_code}/metric`
*   **Payload de petición:**
    ```json
    {
      "event_type": "SCAN" 
    }
    ```
    *   `event_type`: Valores permitidos: `SCAN` (cuando se lee la URL), `CLICK_GOOGLE` (cuando un usuario califica 4-5 y hace click al botón de Google Maps).
*   **Respuestas:**
    *   **204 No Content** (Sin cuerpo de respuesta).

---

## 🔒 Endpoints Administrativos (Panel de Control B2B)

Todos estos endpoints requieren autenticación mediante JWT.

### 1. Iniciar Sesión (Login)
*   **Ruta:** `POST /v1/auth/login`
*   **Payload de petición:**
    ```json
    {
      "email": "gerente@bellavista.com",
      "password": "mi_secure_password"
    }
    ```
*   **Respuestas:**
    *   **200 OK:**
        ```json
        {
          "access_token": "eyJhbGciOi...",
          "token_type": "bearer",
          "expires_in": 86400
        }
        ```
    *   **401 Unauthorized:** Credenciales incorrectas.

---

### 2. Obtener Configuración del Local
*   **Ruta:** `GET /v1/admin/location`
*   **Respuestas:**
    *   **200 OK (Filtrado automáticamente por RLS basado en el JWT):**
        ```json
        {
          "id": "8f8b8a92-d922-48ea-8b43-4c91a457053e",
          "name": "Restaurante Bella Vista",
          "logo_url": "https://cdn.midominio.com/logos/bella_vista.png",
          "primary_color": "#FF5733",
          "secondary_color": "#C70039",
          "google_maps_url": "https://maps.google.com/?cid=123456789",
          "is_active": true
        }
        ```

---

### 3. Actualizar Configuración del Local
*   **Ruta:** `PUT /v1/admin/location`
*   **Payload de petición:**
    ```json
    {
      "name": "Restaurante Bella Vista - Premium",
      "logo_url": "https://cdn.midominio.com/logos/bella_vista_v2.png",
      "primary_color": "#1A1A1A",
      "secondary_color": "#FFD700",
      "google_maps_url": "https://maps.google.com/?cid=987654321"
    }
    ```
*   **Respuestas:**
    *   **200 OK:** Devuelve el objeto `location` actualizado.
    *   **400 Bad Request:** Datos inválidos (ej. colores hexadecimales mal formateados).

---

### 4. Consultar Historial de Quejas (Feedbacks Internos)
Permite al administrador revisar las opiniones anónimas de 1-3 estrellas recibidas.

*   **Ruta:** `GET /v1/admin/feedback`
*   **Parámetros de consulta (Query Params):**
    *   `page` (int, default: 1)
    *   `limit` (int, default: 10)
*   **Respuestas:**
    *   **200 OK (Filtrado por RLS):**
        ```json
        {
          "items": [
            {
              "id": "e89c62de-1678-43e5-8120-0f2d90d7ad23",
              "rating": 2,
              "comment": "La comida llegó fría...",
              "created_at": "2026-07-03T12:00:00Z"
            }
          ],
          "total_items": 45,
          "page": 1,
          "total_pages": 5
        }
        ```

---

### 5. Obtener Analíticas de Rendimiento
Entrega las estadísticas requeridas para las gráficas del panel de control.

*   **Ruta:** `GET /v1/admin/analytics`
*   **Respuestas:**
    *   **200 OK (Filtrado por RLS):**
        ```json
        {
          "summary": {
            "total_scans": 1250,
            "total_redirects_google": 780,
            "total_internal_feedbacks": 62,
            "gating_efficiency_percentage": 92.6
          },
          "ratings_distribution": {
            "5_stars": 600,
            "4_stars": 180,
            "3_stars": 30,
            "2_stars": 20,
            "1_star": 12
          },
          "weekly_activity": [
            {
              "date": "2026-06-27",
              "scans": 150,
              "google_clicks": 95,
              "internal_feedbacks": 5
            }
          ]
        }
        ```

---

## 🛠️ Endpoints del Súper Administrador (Control Manual Global)

Estos endpoints solo son accesibles por usuarios con rol `superadmin`.

### 1. Activar / Desactivar Tenant (Control por Impago)
*   **Ruta:** `PUT /v1/superadmin/tenants/{tenant_id}/status`
*   **Payload de petición:**
    ```json
    {
      "is_active": false,
      "reason": "Impago mensualidad de junio"
    }
    ```
*   **Respuestas:**
    *   **200 OK:**
        ```json
        {
          "tenant_id": "3b290912-32a2-4a00-ab21-0a6ef295cc01",
          "is_active": false,
          "updated_at": "2026-07-03T13:00:00Z"
        }
        ```
    *   **403 Forbidden:** El usuario autenticado no tiene permisos de súper administrador.
    *   **404 Not Found:** Tenant no encontrado.

---

### 2. Aprovisionar Nuevo Tenant (Creación de Cuenta y Local)
Permite al súper administrador crear un nuevo cliente en el sistema, generando su primer local, sus accesos administrativos y el código corto inicial del tag NFC.

*   **Ruta:** `POST /v1/superadmin/tenants`
*   **Payload de petición:**
    ```json
    {
      "name": "Restaurante Bella Vista",
      "email": "gerente@bellavista.com"
    }
    ```
*   **Respuestas:**
    *   **201 Created:**
        ```json
        {
          "tenant_id": "3b290912-32a2-4a00-ab21-0a6ef295cc01",
          "location_id": "8f8b8a92-d922-48ea-8b43-4c91a457053e",
          "user_id": "b96dc2c8-89f5-467b-bf38-a28d11c002cb",
          "email": "gerente@bellavista.com",
          "temporary_password": "TEMP_a8b9c10_xyz",
          "short_code": "a7b8c9"
        }
        ```
    *   **400 Bad Request (Email ya registrado o datos inválidos):**
        ```json
        {
          "detail": "Email already registered."
        }
        ```
    *   **403 Forbidden:** El usuario autenticado no tiene permisos de súper administrador.
