import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models.account import Account
from app.schemas.account import AccountCreate, AccountRead, AccountUpdate

router = APIRouter(prefix="/accounts", tags=["accounts"])


async def _get_owned_account(
    account_id: uuid.UUID, user_id: uuid.UUID, db: DbSession
) -> Account:
    account = await db.get(Account, account_id)
    if account is None or account.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta no encontrada"
        )
    return account


@router.get("", response_model=list[AccountRead])
async def list_accounts(
    current_user: CurrentUser,
    db: DbSession,
    include_archived: bool = Query(default=False),
) -> list[Account]:
    stmt = select(Account).where(Account.user_id == current_user.id)
    if not include_archived:
        stmt = stmt.where(Account.is_archived.is_(False))
    stmt = stmt.order_by(Account.name)
    return list((await db.scalars(stmt)).all())


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate, current_user: CurrentUser, db: DbSession
) -> Account:
    account = Account(
        user_id=current_user.id,
        name=payload.name,
        type=payload.type,
        currency=(payload.currency or current_user.base_currency).upper(),
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountRead)
async def get_account(
    account_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> Account:
    return await _get_owned_account(account_id, current_user.id, db)


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> Account:
    account = await _get_owned_account(account_id, current_user.id, db)
    data = payload.model_dump(exclude_unset=True)
    if data.get("currency"):
        data["currency"] = data["currency"].upper()
    for field, value in data.items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_account(
    account_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    account = await _get_owned_account(account_id, current_user.id, db)
    account.is_archived = True
    await db.commit()
    return None
