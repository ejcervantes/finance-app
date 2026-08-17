"""Seed de categorías del sistema (user_id = NULL, visibles para todos).

Idempotente: se puede correr varias veces sin duplicar.

    docker compose exec backend python -m app.db.seed
"""

import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.category import Category

# Categorías predefinidas. No llevan tipo (ingreso/gasto) porque eso vive
# en la transacción; son solo etiquetas de uso común.
SYSTEM_CATEGORIES: list[dict] = [
    # Gastos comunes
    {"name": "Comida", "icon": "🍽️", "color": "#F59E0B"},
    {"name": "Restaurantes", "icon": "🍔", "color": "#EF4444"},
    {"name": "Transporte", "icon": "🚗", "color": "#3B82F6"},
    {"name": "Vivienda", "icon": "🏠", "color": "#8B5CF6"},
    {"name": "Servicios", "icon": "💡", "color": "#10B981"},
    {"name": "Salud", "icon": "🩺", "color": "#EC4899"},
    {"name": "Entretenimiento", "icon": "🎬", "color": "#F97316"},
    {"name": "Ropa", "icon": "👕", "color": "#06B6D4"},
    {"name": "Educación", "icon": "📚", "color": "#6366F1"},
    {"name": "Mascotas", "icon": "🐾", "color": "#84CC16"},
    {"name": "Regalos", "icon": "🎁", "color": "#D946EF"},
    {"name": "Otros gastos", "icon": "📦", "color": "#6B7280"},
    # Ingresos comunes
    {"name": "Salario", "icon": "💼", "color": "#22C55E"},
    {"name": "Freelance", "icon": "💻", "color": "#14B8A6"},
    {"name": "Inversiones", "icon": "📈", "color": "#0EA5E9"},
    {"name": "Otros ingresos", "icon": "💰", "color": "#65A30D"},
]


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        created = 0
        for data in SYSTEM_CATEGORIES:
            exists = await db.scalar(
                select(Category).where(
                    Category.user_id.is_(None), Category.name == data["name"]
                )
            )
            if exists:
                continue
            db.add(Category(user_id=None, **data))
            created += 1
        await db.commit()
        print(f"Seed completado: {created} categorías nuevas del sistema.")


if __name__ == "__main__":
    asyncio.run(seed())
