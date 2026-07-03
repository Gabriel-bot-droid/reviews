# QuickFeedback NFC - SaaS de Redirección Inteligente de Reseñas

**QuickFeedback NFC** es una plataforma SaaS B2B, multi-tenant y escalable que permite a negocios físicos (restaurantes, tiendas, cafeterías) gestionar su reputación en línea en tiempo real a través de tarjetas NFC y códigos QR inteligentes.

El sistema intercepta la experiencia del cliente antes de que llegue a plataformas públicas como Google Maps. Si la experiencia es positiva, facilita la publicación de la reseña en Google. Si es negativa, recopila el feedback de manera interna y anónima para que el administrador del local pueda tomar medidas correctivas inmediatas, protegiendo la reputación pública del negocio.

---

## 🚀 Características Principales

*   **Redirección Dinámica (`/r/{short_code}`):** Los chips NFC y códigos QR apuntan a una URL de redirección corta y ofuscada gestionada por el backend. Permite habilitar, deshabilitar o reconfigurar enlaces de reseñas sin necesidad de reprogramar los dispositivos físicos.
*   **Embudo de Calificación Persuasivo (Gating Compliant):**
    *   **Calificación Alta (4-5 estrellas):** Redirección optimizada y directa al perfil de reseñas de Google Maps del local.
    *   **Calificación Baja (1-3 estrellas):** Formulario interno simplificado y 100% anónimo para capturar quejas o sugerencias sin fricción. Incluye un enlace sutil y opcional hacia Google Maps para cumplir estrictamente con las políticas de Google My Business.
*   **Arquitectura Multi-tenant Eficiente:** Aislamiento de datos lógicos mediante Row-Level Security (RLS) en PostgreSQL a nivel de base de datos, compartiendo una única instancia para optimizar costos de infraestructura en fases iniciales.
*   **Panel de Administración del Local:** Dashboard analítico interactivo donde los dueños de locales pueden ver métricas de escaneo, distribución de calificaciones y el historial de feedback interno.
*   **Control del Estado del Servicio (Desactivación por Impago):** Los administradores globales pueden suspender la cuenta de un tenant de forma inmediata, lo que bloquea el flujo NFC mostrando una pantalla elegante de "Servicio suspendido".

---

## 🛠️ Stack Tecnológico

### Backend (API)
*   **Lenguaje:** Python 3.10+
*   **Framework:** FastAPI (Asíncrono, de alto rendimiento, autogeneración de OpenAPI/Swagger).
*   **ORM:** SQLAlchemy 2.0 (asíncrono) + Alembic para migraciones.
*   **Base de Datos:** PostgreSQL con RLS (Row-Level Security) habilitado.
*   **Caché en Memoria:** Redis para resolución ultra-veloz (sub-2ms) de redirecciones NFC y rate-limiting de peticiones.
*   **Seguridad:** JWT (JSON Web Tokens) para autenticación de sesiones administrativas, hashing de contraseñas con bcrypt.

### Frontend
*   **Framework:** React / Next.js 14+ (App Router).
*   **Estilos:** Vanilla CSS (Diseño responsivo premium, transiciones suaves, soporte para modo oscuro nativo).
*   **Gráficos:** Recharts o Chart.js para analíticas en el panel administrativo.

---

## 📦 Estructura del Proyecto

```text
reviews/
├── backend/                # API en FastAPI
│   ├── app/
│   │   ├── api/            # Endpoints y Rutas divididas por versión (v1)
│   │   ├── core/           # Configuración del sistema, seguridad y base de datos
│   │   ├── models/         # Modelos de base de datos SQLAlchemy con RLS
│   │   ├── schemas/        # Schemas Pydantic para validación de datos
│   │   ├── services/       # Lógica de negocio (resolución de shortcode, métricas)
│   │   └── main.py         # Punto de entrada de la aplicación FastAPI
│   ├── migrations/         # Migraciones de base de datos gestionadas por Alembic
│   ├── requirements.txt    # Dependencias de Python
│   └── alembic.ini         # Configuración de Alembic
│
└── frontend/               # Frontend en Next.js
    ├── src/
    │   ├── app/            # Rutas y páginas de Next.js (App Router)
    │   │   ├── r/[code]/   # Landing del embudo de calificación (cliente final)
    │   │   ├── admin/      # Panel de administración (dueño del local)
    │   │   └── login/      # Formulario de autenticación para admins
    │   ├── components/     # Componentes compartidos y reutilizables de UI
    │   └── styles/         # CSS Global y tokens de diseño
    ├── package.json        # Dependencias de npm y scripts
    └── next.config.js      # Configuración de Next.js
```

---

## ⚙️ Configuración y Desarrollo Local

### Requisitos Previos
*   Python 3.10 o superior instalado.
*   Node.js 18.x o superior instalado.
*   PostgreSQL 14 o superior y Redis 6.x o superior instalados y corriendo localmente.

### Backend

1.  Navega al directorio del backend e instala las dependencias:
    ```bash
    cd backend
    python -m venv venv
    ./venv/Scripts/activate  # En Windows (PowerShell)
    pip install -r requirements.txt
    ```

2.  Crea un archivo `.env` en `backend/` basado en la plantilla de configuración:
    ```env
    DATABASE_URL=postgresql+asyncpg://usuario:contraseña@localhost:5432/reviews_db
    REDIS_URL=redis://localhost:6379/0
    JWT_SECRET_KEY=supersecretkey_cambiame_en_produccion
    ACCESS_TOKEN_EXPIRE_MINUTES=1440
    CORS_ORIGINS=["http://localhost:3000"]
    ```

3.  Ejecuta las migraciones para crear las tablas con RLS:
    ```bash
    alembic upgrade head
    ```

4.  Inicia el servidor de desarrollo de FastAPI:
    ```bash
    uvicorn app.main:app --reload
    ```
    La documentación interactiva estará disponible en [http://localhost:8000/docs](http://localhost:8000/docs).

### Frontend

1.  Navega al directorio del frontend e instala las dependencias:
    ```bash
    cd ../frontend
    npm install
    ```

2.  Crea un archivo `.env.local` en `frontend/`:
    ```env
    NEXT_PUBLIC_API_URL=http://localhost:8000
    ```

3.  Inicia el servidor de desarrollo de Next.js:
    ```bash
    npm run dev
    ```
    Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.
