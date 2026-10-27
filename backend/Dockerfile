FROM python:3.10-slim

# Evitar que Python escriba archivos .pyc en el disco
ENV PYTHONDONTWRITEBYTECODE 1
# Evitar que Python almacene en búfer las salidas estándar
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Instalar dependencias del sistema requeridas para compilar paquetes
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del backend
COPY . /app/

# Crear el directorio para los uploads si no existe y dar permisos
RUN mkdir -p /app/static/uploads \
    && chmod -R 755 /app/static

# Hacer ejecutable el script de inicio
RUN chmod +x /app/start.sh

EXPOSE 8000

# Punto de entrada por defecto
ENTRYPOINT ["/app/start.sh"]
