import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select

from app.deps import CurrentUser, DbSession
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


async def _get_accessible_category(
    category_id: uuid.UUID, user_id: uuid.UUID, db: DbSession
) -> Category:
    """Devuelve la categoría si es del usuario o del sistema; si no, 404."""
    category = await db.get(Category, category_id)
    if category is None or (
        category.user_id is not None and category.user_id != user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada"
        )
    return category


def _ensure_owned(category: Category) -> None:
    """Las categorías del sistema son de solo lectura."""
    if category.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Las categorías del sistema no se pueden modificar",
        )


@router.get("", response_model=list[CategoryRead])
async def list_categories(
    current_user: CurrentUser,
    db: DbSession,
    include_archived: bool = Query(default=False),
) -> list[Category]:
    # Del sistema (user_id NULL) + las propias
    stmt = select(Category).where(
        or_(Category.user_id.is_(None), Category.user_id == current_user.id)
    )
    if not include_archived:
        stmt = stmt.where(Category.is_archived.is_(False))
    stmt = stmt.order_by(Category.name)
    result = await db.scalars(stmt)
    return list(result.all())


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate, current_user: CurrentUser, db: DbSession
) -> Category:
    category = Category(
        user_id=current_user.id,
        name=payload.name,
        icon=payload.icon,
        color=payload.color,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.get("/{category_id}", response_model=CategoryRead)
async def get_category(
    category_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> Category:
    return await _get_accessible_category(category_id, current_user.id, db)


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> Category:
    category = await _get_accessible_category(category_id, current_user.id, db)
    _ensure_owned(category)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_category(
    category_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    category = await _get_accessible_category(category_id, current_user.id, db)
    _ensure_owned(category)
    # Borrado suave: se archiva para no romper el historial de transacciones.
    category.is_archived = True
    await db.commit()
    return None
