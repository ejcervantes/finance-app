import uuid
from datetime import date

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from sqlalchemy import Select, func, or_, select

from app.core.config import settings
from app.deps import CurrentUser, DbSession
from app.models.account import Account
from app.models.category import Category
from app.models.enums import (
    ExpenseNature,
    NatureSource,
    TransactionSource,
    TransactionType,
)
from app.models.receipt import Receipt
from app.models.transaction import Transaction
from app.schemas.receipt import ReceiptScanResponse
from app.schemas.transaction import (
    BulkError,
    BulkResult,
    BulkTransactionCreate,
    TransactionCreate,
    TransactionList,
    TransactionRead,
    TransactionUpdate,
)
from app.services.ai import get_ai_provider
from app.services.ai.base import CategoryHint
from app.services.storage import get_storage

router = APIRouter(prefix="/transactions", tags=["transactions"])

# Campos permitidos para ordenar (evita inyección de columnas arbitrarias)
_SORT_FIELDS = {
    "transaction_date": Transaction.transaction_date,
    "amount": Transaction.amount,
    "created_at": Transaction.created_at,
}


async def _validate_category(
    category_id: uuid.UUID,
    user_id: uuid.UUID,
    db: DbSession,
    expected_type: TransactionType,
) -> None:
    """La categoría debe existir, ser accesible (propia o del sistema), no estar
    archivada, y su tipo debe coincidir con el del movimiento."""
    category = await db.get(Category, category_id)
    if category is None or (
        category.user_id is not None and category.user_id != user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La categoría no existe o no es accesible",
        )
    if category.is_archived:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se puede usar una categoría archivada",
        )
    if category.type != expected_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La categoría no corresponde al tipo (ingreso/gasto) del movimiento",
        )


async def _validate_account(
    account_id: uuid.UUID, user_id: uuid.UUID, db: DbSession
) -> None:
    """Si se indica cuenta, debe ser del usuario y no estar archivada."""
    account = await db.get(Account, account_id)
    if account is None or account.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La cuenta no existe o no es accesible",
        )
    if account.is_archived:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se puede usar una cuenta archivada",
        )


def _apply_sort(stmt: Select, sort: str) -> Select:
    descending = sort.startswith("-")
    key = sort[1:] if descending else sort
    column = _SORT_FIELDS.get(key, Transaction.transaction_date)
    return stmt.order_by(column.desc() if descending else column.asc())


@router.get("", response_model=TransactionList)
async def list_transactions(
    current_user: CurrentUser,
    db: DbSession,
    date_from: date | None = None,
    date_to: date | None = None,
    type: TransactionType | None = None,
    category_id: uuid.UUID | None = None,
    account_id: uuid.UUID | None = None,
    expense_nature: ExpenseNature | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    sort: str = Query(default="-transaction_date"),
) -> TransactionList:
    conditions = [Transaction.user_id == current_user.id]
    if date_from is not None:
        conditions.append(Transaction.transaction_date >= date_from)
    if date_to is not None:
        conditions.append(Transaction.transaction_date <= date_to)
    if type is not None:
        conditions.append(Transaction.type == type)
    if category_id is not None:
        conditions.append(Transaction.category_id == category_id)
    if account_id is not None:
        conditions.append(Transaction.account_id == account_id)
    if expense_nature is not None:
        conditions.append(Transaction.expense_nature == expense_nature)
    if search:
        like = f"%{search}%"
        conditions.append(
            or_(
                Transaction.description.ilike(like),
                Transaction.notes.ilike(like),
            )
        )

    total = await db.scalar(
        select(func.count()).select_from(Transaction).where(*conditions)
    )

    stmt = select(Transaction).where(*conditions)
    stmt = _apply_sort(stmt, sort)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    items = list((await db.scalars(stmt)).all())

    return TransactionList(
        items=[TransactionRead.model_validate(i) for i in items],
        total=total or 0,
        page=page,
        page_size=page_size,
    )


async def _build_transaction(
    payload: TransactionCreate, user, db: DbSession
) -> Transaction:
    """Valida y construye una transacción (la agrega a la sesión, SIN commit).
    Se reutiliza tanto en la creación simple como en la importación masiva."""
    await _validate_category(payload.category_id, user.id, db, payload.type)
    if payload.account_id is not None:
        await _validate_account(payload.account_id, user.id, db)

    # Si viene de un recibo escaneado, se enlaza y la fuente es receipt_scan.
    receipt: Receipt | None = None
    if payload.receipt_id is not None:
        receipt = await db.get(Receipt, payload.receipt_id)
        if receipt is None or receipt.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El recibo no existe o no es accesible",
            )

    transaction = Transaction(
        user_id=user.id,
        type=payload.type,
        amount=payload.amount,
        currency=payload.currency or user.base_currency,
        expense_nature=payload.expense_nature,
        description=payload.description,
        transaction_date=payload.transaction_date,
        account_id=payload.account_id,
        category_id=payload.category_id,
        notes=payload.notes,
        source=TransactionSource.receipt_scan if receipt else TransactionSource.manual,
        nature_source=_derive_nature_source(payload.expense_nature, receipt),
        receipt_id=payload.receipt_id,
    )
    db.add(transaction)
    return transaction


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate, current_user: CurrentUser, db: DbSession
) -> Transaction:
    transaction = await _build_transaction(payload, current_user, db)
    await db.commit()
    await db.refresh(transaction)
    return transaction


@router.post("/bulk", response_model=BulkResult)
async def bulk_create_transactions(
    payload: BulkTransactionCreate, current_user: CurrentUser, db: DbSession
) -> BulkResult:
    """Importación masiva: recorre la lista y crea cada transacción reusando la
    misma validación que la creación simple. Es atómico: si alguna fila falla,
    no se crea ninguna y se devuelven todos los errores para corregir."""
    errors: list[BulkError] = []
    for i, item in enumerate(payload.items):
        try:
            await _build_transaction(item, current_user, db)
        except HTTPException as exc:
            errors.append(BulkError(index=i, detail=str(exc.detail)))

    if errors:
        await db.rollback()
        return BulkResult(created=0, errors=errors)

    await db.commit()
    return BulkResult(created=len(payload.items), errors=[])


def _derive_nature_source(
    expense_nature: ExpenseNature | None, receipt: Receipt | None
) -> NatureSource | None:
    """Si no hay naturaleza → None. Si viene de un recibo y coincide con lo que
    sugirió la IA → 'ai'. En cualquier otro caso (manual o corregido) → 'user'."""
    if expense_nature is None:
        return None
    if receipt is not None:
        suggested = receipt.raw_extraction.get("suggested_expense_nature")
        if suggested == expense_nature.value:
            return NatureSource.ai
    return NatureSource.user


@router.post(
    "/scan", response_model=ReceiptScanResponse, status_code=status.HTTP_200_OK
)
async def scan_receipt(
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
) -> ReceiptScanResponse:
    """Sube una foto de recibo, la analiza con IA y devuelve un BORRADOR.
    No crea la transacción: el usuario confirma con POST /transactions."""
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El archivo debe ser una imagen",
        )
    data = await file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"La imagen supera {settings.max_upload_mb} MB",
        )

    # Categorías accesibles (sistema + propias, no archivadas) como opciones para la IA
    cats = list(
        (
            await db.scalars(
                select(Category).where(
                    or_(
                        Category.user_id.is_(None),
                        Category.user_id == current_user.id,
                    ),
                    Category.is_archived.is_(False),
                )
            )
        ).all()
    )
    hints = [CategoryHint(id=c.id, name=c.name) for c in cats]

    extraction = await get_ai_provider().extract_receipt(
        data, file.content_type, hints
    )

    image_url = await get_storage().save(data, file.content_type)

    receipt = Receipt(
        user_id=current_user.id,
        image_url=image_url,
        raw_extraction=extraction.model_dump(mode="json"),
    )
    db.add(receipt)
    await db.commit()
    await db.refresh(receipt)

    return ReceiptScanResponse(
        receipt_id=receipt.id,
        image_url=image_url,
        **extraction.model_dump(),
    )


async def _get_owned_transaction(
    transaction_id: uuid.UUID, user_id: uuid.UUID, db: DbSession
) -> Transaction:
    transaction = await db.get(Transaction, transaction_id)
    if transaction is None or transaction.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transacción no encontrada"
        )
    return transaction


@router.get("/{transaction_id}", response_model=TransactionRead)
async def get_transaction(
    transaction_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> Transaction:
    return await _get_owned_transaction(transaction_id, current_user.id, db)


@router.patch("/{transaction_id}", response_model=TransactionRead)
async def update_transaction(
    transaction_id: uuid.UUID,
    payload: TransactionUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> Transaction:
    transaction = await _get_owned_transaction(transaction_id, current_user.id, db)
    data = payload.model_dump(exclude_unset=True)

    if "account_id" in data and data["account_id"] is not None:
        await _validate_account(data["account_id"], current_user.id, db)

    for field, value in data.items():
        setattr(transaction, field, value)

    # Coherencia categoría↔tipo con los valores finales (si cambió alguno).
    if "category_id" in data or "type" in data:
        await _validate_category(
            transaction.category_id, current_user.id, db, transaction.type
        )

    # Coherencia: un ingreso no lleva naturaleza de gasto.
    if transaction.type == TransactionType.income:
        transaction.expense_nature = None
        transaction.nature_source = None
    elif "expense_nature" in data:
        transaction.nature_source = (
            NatureSource.user if transaction.expense_nature is not None else None
        )

    await db.commit()
    await db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    transaction = await _get_owned_transaction(transaction_id, current_user.id, db)
    # Borrado real (decisión 10): una transacción es un hecho, no un catálogo.
    await db.delete(transaction)
    await db.commit()
    return None
