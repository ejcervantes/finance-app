"""Seed de categorías del sistema (user_id = NULL, visibles para todos).

Idempotente y UPSERT: inserta las que faltan y actualiza tipo/naturaleza/estilo
de las que ya existen (por nombre). Se puede correr varias veces.

    docker compose exec backend python -m app.db.seed
"""

import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.category import Category

# Categorías predefinidas con su tipo (ingreso/gasto) y, para gastos, una
# naturaleza sugerida por defecto (editable al registrar el movimiento).
SYSTEM_CATEGORIES: list[dict] = [
    # Gastos
    {"name": "Comida", "type": "expense", "default_nature": "fixed", "icon": "🍽️", "color": "#F59E0B"},
    {"name": "Restaurantes", "type": "expense", "default_nature": "discretionary", "icon": "🍔", "color": "#EF4444"},
    {"name": "Transporte", "type": "expense", "default_nature": "variable", "icon": "🚗", "color": "#3B82F6"},
    {"name": "Vivienda", "type": "expense", "default_nature": "fixed", "icon": "🏠", "color": "#8B5CF6"},
    {"name": "Servicios", "type": "expense", "default_nature": "fixed", "icon": "💡", "color": "#10B981"},
    {"name": "Salud", "type": "expense", "default_nature": "fixed", "icon": "🩺", "color": "#EC4899"},
    {"name": "Entretenimiento", "type": "expense", "default_nature": "discretionary", "icon": "🎬", "color": "#F97316"},
    {"name": "Ropa", "type": "expense", "default_nature": "variable", "icon": "👕", "color": "#06B6D4"},
    {"name": "Educación", "type": "expense", "default_nature": "fixed", "icon": "📚", "color": "#6366F1"},
    {"name": "Mascotas", "type": "expense", "default_nature": "variable", "icon": "🐾", "color": "#84CC16"},
    {"name": "Regalos", "type": "expense", "default_nature": "discretionary", "icon": "🎁", "color": "#D946EF"},
    {"name": "Otros gastos", "type": "expense", "default_nature": "variable", "icon": "📦", "color": "#6B7280"},
    # Ingresos (sin naturaleza)
    {"name": "Salario", "type": "income", "default_nature": None, "icon": "💼", "color": "#22C55E"},
    {"name": "Freelance", "type": "income", "default_nature": None, "icon": "💻", "color": "#14B8A6"},
    {"name": "Inversiones", "type": "income", "default_nature": None, "icon": "📈", "color": "#0EA5E9"},
    {"name": "Otros ingresos", "type": "income", "default_nature": None, "icon": "💰", "color": "#65A30D"},
]


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        created, updated = 0, 0
        for data in SYSTEM_CATEGORIES:
            existing = await db.scalar(
                select(Category).where(
                    Category.user_id.is_(None), Category.name == data["name"]
                )
            )
            if existing:
                existing.type = data["type"]
                existing.default_nature = data["default_nature"]
                existing.icon = data["icon"]
                existing.color = data["color"]
                updated += 1
            else:
                db.add(Category(user_id=None, **data))
                created += 1
        await db.commit()
        print(f"Seed completado: {created} nuevas, {updated} actualizadas.")


if __name__ == "__main__":
    asyncio.run(seed())
