#!/bin/sh

# Salir inmediatamente si algún comando falla
set -e

echo "Aplicando migraciones de base de datos..."
alembic upgrade head

echo "Inicializando servidor FastAPI de producción..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
