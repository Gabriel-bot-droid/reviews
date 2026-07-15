# QuickFeedback NFC — SaaS de Redirección Inteligente de Reseñas

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Cache-Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)

**QuickFeedback NFC** es una plataforma SaaS B2B, multi-tenant y escalable que permite a negocios físicos (como restaurantes, cafeterías, tiendas y hoteles) gestionar su reputación en línea en tiempo real mediante tarjetas físicas NFC y códigos QR inteligentes.

El sistema intercepta la experiencia del cliente antes de que llegue a plataformas públicas de opinión (como Google Maps / Yelp). 
- **Experiencia Positiva (4-5 estrellas):** Facilita e incentiva la publicación de la reseña pública en el perfil de Google Maps del negocio.
- **Experiencia Negativa o Sugerencia (1-3 estrellas):** Intercepta el feedback a través de un formulario interno y 100% anónimo para que el administrador del local pueda tomar medidas correctivas inmediatas, previniendo así un impacto negativo en la calificación pública.

---

## 🚀 Características Principales

*   **Redirección Dinámica e Inteligente (`/r/{short_code}`):** Las tarjetas NFC y los códigos QR apuntan a un enlace corto y único. El backend procesa este código para redirigir dinámicamente según la configuración de branding e inactividad, evitando tener que reprogramar los tags físicos.
*   **Embudo de Calificación Persuasivo (Gating Compliant):**
    *   *Calificaciones Altas:* Enlace directo y optimizado a la sección de opiniones de Google.
    *   *Calificaciones Bajas:* Recopila críticas constructivas de forma privada y anónima. Cumple con las normativas de Google My Business (Google Maps) al proveer un enlace de salida discreto para evitar penalizaciones por "review gating".
*   **Multi-tenant Robusto:** Aislamiento lógico estricto a nivel de base de datos utilizando **Row-Level Security (RLS)** de PostgreSQL. Múltiples tenants comparten la misma base de datos reduciendo costes pero garantizando aislamiento completo.
*   **Panel Administrativo (Dashboard):** Panel de control premium para los dueños de los locales que permite visualizar:
    *   Tasa de escaneos y conversión.
    *   Distribución de calificaciones en tiempo real.
    *   Historial completo de feedback constructivo interno.
    *   Configuración visual del branding del local (logotipo, colores, enlace de Google Maps y umbral de calificación).
*   **Desactivación y Suspensión en Tiempo Real:** Permite a los super-administadores suspender a un tenant por falta de pago o incumplimiento, bloqueando el flujo NFC en el acto y mostrando una pantalla de servicio inactivo.

---

## 🛠️ Stack Tecnológico

### Backend (API REST)
*   **Python 3.10+** con **FastAPI** (asíncrono y de muy alto rendimiento).
*   **SQLAlchemy 2.0 (Async)** y **Alembic** para la administración de migraciones.
*   **PostgreSQL** con políticas de Row-Level Security (RLS).
*   **Redis** para resolución ultra-veloz (sub-2ms) de códigos y limitación de tasa (Rate Limiting).
*   **JWT & bcrypt** para autenticación segura de los administradores.

### Frontend
*   **React 19** y **Next.js 16 (App Router)**.
*   **Vanilla CSS** con variables personalizadas para soportar múltiples marcas y branding en tiempo real.
*   Gráficos dinámicos con **Recharts** para analíticas de rendimiento.

---

## 📐 Arquitectura de Alto Nivel

El sistema separa estrictamente la API del cliente web de administración y la landing page ligera de resolución:

```mermaid
graph TD
    Client[Cliente / NFC Scan] -->|1. HTTP GET /r/xyz123| FE[Frontend Next.js]
    FE -->|2. API GET /v1/resolver/xyz123| BE[Backend FastAPI]
    BE -->|3a. Check Cache| Redis[(Redis Cache)]
    Redis -->|3b. Hit: Return Config| BE
    Redis -->|3c. Miss: Query DB| DB[(PostgreSQL con RLS)]
    BE -->|4. Config / Status response| FE
    FE -->|5a. Renderiza Embudo si Activo| CustomerUI[Embudo de Calificación]
    FE -->|5b. Renderiza Pantalla de Suspensión| SuspendedUI[Servicio Inactivo]
    Admin[Dueño de Local] -->|HTTP Login / Dashboard| FE
    FE -->|API Request con JWT| BE
```

---

## 📦 Estructura del Repositorio

El proyecto está organizado en un monorepo dividido en dos carpetas principales:

```text
reviews/
├── backend/                # API FastAPI y lógica de negocio
│   ├── app/
│   │   ├── api/            # Controladores y endpoints REST (/v1)
│   │   ├── core/           # Configuración (Pydantic), base de datos y seguridad
│   │   ├── models/         # Modelos de datos de SQLAlchemy con políticas RLS
│   │   ├── schemas/        # Validaciones con Schemas Pydantic
│   │   ├── services/       # Capa de servicios (resolución de NFC, métricas)
│   │   └── main.py         # Inicialización de la app FastAPI
│   ├── migrations/         # Migraciones de base de datos de Alembic
│   ├── requirements.txt    # Dependencias de Python
│   └── alembic.ini         # Configuración del CLI de Alembic
│
├── frontend/               # Frontend SPA en Next.js
│   ├── src/
│   │   ├── app/            # Rutas del App Router (login, admin, r/[code])
│   │   ├── utils/          # Cliente API y utilidades de Javascript
│   │   └── styles/         # Estilos CSS y tokens de diseño
│   ├── package.json        # Dependencias y scripts de Next.js
│   └── next.config.mjs     # Configuración de Next.js
│
└── documentos/             # Especificaciones técnicas completas
```

---

## 📖 Documentación Detallada

Puedes profundizar en los aspectos internos del sistema revisando la documentación técnica dentro de la carpeta `documentos/`:

*   [**Arquitectura del Sistema**](documentos/ARCHITECTURE.md): Flujos de datos detallados, lógica de Row-Level Security y caché.
*   [**Especificación de la API (API Spec)**](documentos/API_SPEC.md): Endpoints disponibles, parámetros, códigos de respuesta y rate-limiting.
*   [**Esquema de Base de Datos**](documentos/DATABASE_SCHEMA.md): Diagrama de tablas de PostgreSQL, campos, restricciones y disparadores (triggers) de base de datos.
*   [**Seguridad y Cumplimiento**](documentos/SECURITY_AND_COMPLIANCE.md): Políticas de Google, mitigaciones contra spam, protección de datos y políticas de seguridad implementadas.

---

## ⚙️ Configuración y Desarrollo Local

### Requisitos Previos
*   Python 3.10+ instalado.
*   Node.js 18+ instalado.
*   Instancia local o remota de PostgreSQL 14+ y Redis 6+.

### 1. Servidor Backend (FastAPI)

1.  Navega al directorio del backend e instala las dependencias mediante un entorno virtual:
    ```bash
    cd backend
    python -m venv venv
    
    # En Windows (PowerShell):
    .\venv\Scripts\Activate.ps1
    # En macOS/Linux:
    source venv/bin/activate
    
    pip install -r requirements.txt
    ```

2.  Crea un archivo `.env` en la raíz de la carpeta `backend/` basándote en la siguiente plantilla:
    ```env
    DATABASE_URL=postgresql+asyncpg://reviews_user:reviews_password@localhost:5432/reviews_db
    REDIS_URL=redis://localhost:6379/0
    JWT_SECRET_KEY=cambiar_en_produccion_por_algo_seguro
    ACCESS_TOKEN_EXPIRE_MINUTES=1440
    CORS_ORIGINS=["http://localhost:3000"]
    ```

3.  Ejecuta las migraciones de Alembic para inicializar las tablas de base de datos:
    ```bash
    alembic upgrade head
    ```

4.  Inicia el servidor de desarrollo:
    ```bash
    uvicorn app.main:app --reload
    ```
    La API y su documentación interactiva auto-generada estarán accesibles en [http://localhost:8000/docs](http://localhost:8000/docs).

### 2. Cliente Frontend (Next.js)

1.  Navega al directorio del frontend:
    ```bash
    cd ../frontend
    npm install
    ```

2.  Crea un archivo `.env.local` en la raíz de `frontend/` indicando la URL del backend:
    ```env
    NEXT_PUBLIC_API_URL=http://localhost:8000
    ```

3.  Inicia el servidor de desarrollo del frontend:
    ```bash
    npm run dev
    ```
    Visita la aplicación web local en [http://localhost:3000](http://localhost:3000).

---

## 🛡️ Licencia y Uso
Este software es privado y está protegido. Su uso se rige bajo los términos de suscripción comercial de la plataforma SaaS QuickFeedback NFC.
