import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models.budget import Budget
from app.models.category import Category
from app.schemas.budget import BudgetCreate, BudgetRead, BudgetUpdate

router = APIRouter(prefix="/budgets", tags=["budgets"])


async def _validate_category(
    category_id: uuid.UUID, user_id: uuid.UUID, db: DbSession
) -> None:
    category = await db.get(Category, category_id)
    if category is None or (
        category.user_id is not None and category.user_id != user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La categoría no existe o no es accesible",
        )


async def _get_owned_budget(
    budget_id: uuid.UUID, user_id: uuid.UUID, db: DbSession
) -> Budget:
    budget = await db.get(Budget, budget_id)
    if budget is None or budget.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Presupuesto no encontrado"
        )
    return budget


@router.get("", response_model=list[BudgetRead])
async def list_budgets(current_user: CurrentUser, db: DbSession) -> list[Budget]:
    stmt = select(Budget).where(Budget.user_id == current_user.id)
    return list((await db.scalars(stmt)).all())


@router.post("", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetCreate, current_user: CurrentUser, db: DbSession
) -> Budget:
    await _validate_category(payload.category_id, current_user.id, db)
    budget = Budget(
        user_id=current_user.id,
        category_id=payload.category_id,
        amount=payload.amount,
        period=payload.period,
        start_date=payload.start_date,
    )
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return budget


@router.get("/{budget_id}", response_model=BudgetRead)
async def get_budget(
    budget_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> Budget:
    return await _get_owned_budget(budget_id, current_user.id, db)


@router.patch("/{budget_id}", response_model=BudgetRead)
async def update_budget(
    budget_id: uuid.UUID,
    payload: BudgetUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> Budget:
    budget = await _get_owned_budget(budget_id, current_user.id, db)
    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data and data["category_id"] is not None:
        await _validate_category(data["category_id"], current_user.id, db)
    for field, value in data.items():
        setattr(budget, field, value)
    await db.commit()
    await db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    budget = await _get_owned_budget(budget_id, current_user.id, db)
    await db.delete(budget)
    await db.commit()
    return None
