#!/usr/bin/env sh
# Se ejecuta como pre-deploy en Render (antes de arrancar la app).
# En un script para evitar el parseo de `&&` que hace Render en el comando.
set -e

echo "==> Aplicando migraciones (alembic upgrade head)"
alembic upgrade head

echo "==> Sembrando categorías del sistema"
python -m app.db.seed

echo "==> Pre-deploy completado"
