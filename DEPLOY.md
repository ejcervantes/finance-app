# Despliegue en Render

Guía para desplegar el backend (FastAPI + PostgreSQL + disco para imágenes).
La configuración está en [`render.yaml`](render.yaml).

## Requisitos previos

- Cuenta de **GitHub** (Render despliega desde un repo Git)
- Cuenta de **Render** (https://render.com)
- Tu **API key de Gemini** (la misma que usas en local)

## Paso 1 — Subir el proyecto a GitHub

Desde la raíz del proyecto:

```bash
git init
git add .
git commit -m "Backend + app iOS de finanzas"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/finance-calc.git
git push -u origin main
```

> El `.gitignore` ya excluye secretos (`.env`), el `.xcodeproj` y datos locales.

## Paso 2 — Crear los servicios en Render (Blueprint)

1. En Render: **Dashboard → Blueprints → New Blueprint Instance**
2. Conecta tu repo de GitHub `finance-calc`
3. Render detecta [`render.yaml`](render.yaml) y muestra lo que creará:
   - **finance-backend** (web, Docker)
   - **finance-db** (PostgreSQL)
   - un **disco** de 1 GB para las imágenes de recibos
4. Revisa/ajusta los **planes** (el disco requiere un plan de pago del web service)
5. **Apply** para crear todo

## Paso 3 — Poner el secreto de Gemini

En el servicio **finance-backend → Environment**, agrega:

- `GEMINI_API_KEY` = tu API key

(El `JWT_SECRET_KEY` lo genera Render solo; `DATABASE_URL` se enlaza a la BD.)

Guarda: Render redeploya.

## Paso 4 — Qué hace Render al desplegar

1. Construye la imagen desde `backend/Dockerfile`
2. Ejecuta el **pre-deploy**: `alembic upgrade head && python -m app.db.seed`
   (crea las tablas y siembra las categorías del sistema)
3. Arranca la API en HTTPS: `https://finance-backend-XXXX.onrender.com`

Verifica: abre `https://<tu-url>/health` → `{"status":"ok"}`
y `https://<tu-url>/docs` para la documentación.

## Paso 5 — Apuntar la app iOS a producción

Cambiar el `baseURL` en `ios/FinanceCalc/Core/APIClient.swift` de
`http://localhost:8000` a tu URL de Render, y recompilar. (Lo hacemos juntos.)

---

## Notas

- **Imágenes de recibos:** van al disco persistente (`/data/uploads`). Para
  escalar a varias instancias, migrar a almacenamiento de objetos (Cloudflare R2
  o AWS S3) — anotado para después.
- **Costo aproximado:** web (Starter) + Postgres (Basic) + disco. Revisa precios
  actuales en Render.
- **CORS:** hoy permite todos los orígenes. Cuando exista el frontend web,
  restringir a su dominio (variable `CORS_ORIGINS`).
