# Seguridad y Cumplimiento - QuickFeedback NFC

Este documento describe las políticas, mecanismos técnicos y prácticas de diseño implementadas para asegurar la plataforma **QuickFeedback NFC**, garantizando el cumplimiento de normativas de terceros (específicamente Google My Business) y la protección de datos de carácter privado.

---

## 1. Cumplimiento con las Directrices de Google My Business (Gating)

Google prohíbe de forma estricta desalentar o bloquear reseñas negativas, o solicitar comentarios positivos de forma selectiva ("Review Gating"). 

### ¿Cómo cumple QuickFeedback NFC con esta normativa?
1.  **Enlace Abierto Permanente:** El flujo de feedback de 1-3 estrellas (negativo) nunca actúa como un bloqueo o callejón sin salida técnico. El frontend siempre muestra una "salida de emergencia" consistente en un enlace directo al perfil de reseñas de Google Maps del negocio al pie del formulario, acompañado del texto: *"Si lo prefieres, puedes dejar tu opinión directamente en nuestro perfil público de Google"*.
2.  **No Selección Previa Obligatoria:** Las tarjetas NFC no filtran usuarios en el dispositivo móvil; todos los clientes son dirigidos a la misma pantalla inicial. El usuario tiene libertad de calificar según su criterio y en todo momento mantiene el control de su navegación.

---

## 2. Privacidad de Datos y Cumplimiento de la Ley 19.628 (Chile) / GDPR

### Anonimato Completo del Comensal
Para minimizar el riesgo legal, dar confianza al usuario final y asegurar el cumplimiento de la **Ley 19.628 de Chile** (sobre protección de la vida privada) y el **GDPR europeo**, **no recopilamos Información de Identificación Personal (PII)** de los comensales que envían quejas:
*   **Sin Nombre ni Teléfono:** El formulario de calificación de 1-3 estrellas solo contiene un campo de área de texto para capturar la queja o sugerencia de mejora de forma anónima.
*   **Direcciones IP:** Las direcciones IP no se guardan en la tabla de base de datos de quejas (`feedbacks`). Las métricas de escaneo (`scan_metrics`) son puramente cuantitativas y temporales.
*   **Impacto Legal:** Al no almacenar datos personales de los usuarios finales (como nombres, correos o teléfonos), el sistema queda fuera del ámbito de almacenamiento de datos sensibles de la Ley 19.628 y no requiere complejos flujos de consentimiento de cookies, solicitudes de derecho al olvido (GDPR) o políticas de encriptación de datos personales en tránsito/reposo para los comensales.

---

## 3. Seguridad Multi-tenant y Prevención de Fugas de Datos

El aislamiento de datos se ejecuta en múltiples capas de la pila técnica:

1.  **Capa de Autenticación (JWT):** El `tenant_id` está firmado digitalmente dentro del token de sesión. Un administrador no puede alterar su ID de tenant en la petición puesto que el backend invalida inmediatamente la firma del token si este es manipulado.
2.  **Capa de Base de Datos (Row-Level Security):** Habilitada en todas las tablas transaccionales. PostgreSQL rechaza consultas que no definan el `tenant_id` correcto dentro de la transacción actual (`SET LOCAL app.current_tenant_id`). Esto neutraliza cualquier error de lógica en el código del servidor que pudiera mezclar datos de clientes diferentes.
3.  **Capa de Red (CORS):** Se configuran directivas CORS (Cross-Origin Resource Sharing) estrictas en FastAPI para asegurar que solo el dominio del panel web autorizado pueda consultar los endpoints administrativos.

---

## 4. Control de Abuso, Prevención de Spam y Seguridad de Entradas (XSS)

Dado que los códigos NFC son públicos y físicos, el sistema implementa contramedidas contra el spam de escaneos y comentarios falsos, así como inyecciones maliciosas:

*   **Rate Limiting en Endpoint de Feedback:** El backend limita las peticiones al endpoint `POST /v1/resolver/{short_code}/feedback` por dirección IP (utilizando un almacenamiento rápido en memoria o Redis). Un cliente no puede enviar más de 3 quejas por minuto desde la misma red.
*   **Limpieza de Métricas:** Para evitar ataques de inundación que distorsionen los gráficos de analíticas, el backend ignora registros consecutivos de escaneos (`SCAN`) desde una misma IP dentro de un marco de tiempo corto (ej. 10 minutos), registrando únicamente la primera interacción.
*   **Sanitización y Validación de Inputs (Protección XSS):** Dado que se dispone de un campo de texto abierto para la retroalimentación, existe el riesgo de inyecciones de código HTML/JavaScript (Cross-Site Scripting).
    *   *Backend:* El backend en FastAPI utiliza Pydantic para validar los tipos y límites de caracteres en las entradas, y sanitiza los strings de entrada eliminando etiquetas HTML peligrosas antes de almacenar el comentario en la base de datos.
    *   *Frontend:* Next.js escapa de forma automática todo el texto de las variables que se renderizan en el panel de administración, previniendo que cualquier script malicioso se ejecute en el navegador del administrador del local.

---

## 5. Criptografía y Seguridad de Credenciales

*   **Hashing de Contraseñas:** Las contraseñas del panel de administración se cifran antes de ser almacenadas en la base de datos utilizando el algoritmo robusto **bcrypt** (con factor de costo balanceado). Nunca se guarda texto plano.
*   **Expiración de Sesión:** Los tokens JWT administrativos se emiten con un tiempo de expiración estricto de 24 horas (`ACCESS_TOKEN_EXPIRE_MINUTES = 1440`).
*   **Canal Seguro:** Toda transmisión de datos en la aplicación (producción) se realiza bajo el protocolo cifrado **HTTPS** mediante certificados TLS actualizados.
