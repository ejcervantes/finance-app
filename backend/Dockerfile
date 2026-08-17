FROM python:3.12-slim

# Evita que Python escriba .pyc y bufferee la salida (logs en tiempo real)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /code

# Instala dependencias primero (mejor cache de capas)
COPY pyproject.toml ./
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY prestart.sh ./

RUN pip install --no-cache-dir .

EXPOSE 8000

# Usa $PORT si el proveedor lo inyecta (Render), si no 8000 (local).
# docker-compose sobreescribe este comando para dev (con --reload).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
