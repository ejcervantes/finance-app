# Finance Calc — Backend

API en FastAPI para la plataforma de finanzas personales.
Ver el diseño completo en [`../ARQUITECTURA.md`](../ARQUITECTURA.md).

## Requisitos

- Docker y Docker Compose

## Levantar en desarrollo

Desde la raíz del proyecto (donde está `docker-compose.yml`):

```bash
docker compose up --build
```

Esto levanta:
- **db** — PostgreSQL 16
- **backend** — la API en `http://localhost:8000` (con hot-reload)

### Crear las tablas (migraciones)

La primera vez (y cada vez que cambien los modelos), genera y aplica la migración:

```bash
# 1. Generar la migración a partir de los modelos
docker compose exec backend alembic revision --autogenerate -m "init schema"

# 2. Aplicarla a la base de datos
docker compose exec backend alembic upgrade head
```

## Probar la API

- **Documentación interactiva (Swagger):** http://localhost:8000/docs
- **Health check:** http://localhost:8000/health

### Flujo rápido

1. `POST /api/v1/auth/register` — crea un usuario
2. `POST /api/v1/auth/login` — obtén `access_token` y `refresh_token`
3. En Swagger, botón **Authorize** → pega el `access_token`
4. `GET /api/v1/users/me` — verifica que estás autenticado

## Estructura

```
app/
├── main.py            arranca FastAPI, CORS, monta routers
├── core/              config y seguridad (JWT, hashing)
├── db/                Base ORM y sesión async
├── models/            tablas SQLAlchemy
├── schemas/           validación Pydantic (entrada/salida)
├── api/v1/            endpoints (un archivo por recurso)
└── deps.py            dependencias (usuario actual, sesión)
alembic/               migraciones de BD
```
