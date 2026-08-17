import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import ExpenseNature


class ReceiptScanResponse(BaseModel):
    """Borrador devuelto tras escanear un recibo. NO es una transacción todavía:
    el cliente pre-llena el formulario con esto y el usuario confirma."""

    receipt_id: uuid.UUID
    image_url: str
    amount: Decimal | None
    transaction_date: date | None
    description: str | None
    suggested_category_id: uuid.UUID | None
    suggested_expense_nature: ExpenseNature | None
    confidence: float | None
    reasoning: str | None
    raw_items: list[str]
