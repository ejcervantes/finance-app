import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import (
    ExpenseNature,
    NatureSource,
    TransactionSource,
    TransactionType,
)


class TransactionCreate(BaseModel):
    type: TransactionType
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    expense_nature: ExpenseNature | None = None
    description: str | None = Field(default=None, max_length=255)
    transaction_date: date
    account_id: uuid.UUID | None = None
    category_id: uuid.UUID
    notes: str | None = None
    # Si viene de confirmar un recibo escaneado
    receipt_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def check_nature_matches_type(self) -> "TransactionCreate":
        if self.type == TransactionType.income and self.expense_nature is not None:
            raise ValueError(
                "expense_nature solo aplica a gastos, no a ingresos"
            )
        return self


class TransactionUpdate(BaseModel):
    type: TransactionType | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    expense_nature: ExpenseNature | None = None
    description: str | None = Field(default=None, max_length=255)
    transaction_date: date | None = None
    account_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    notes: str | None = None


class TransactionRead(BaseModel):
    id: uuid.UUID
    type: TransactionType
    amount: Decimal
    currency: str
    expense_nature: ExpenseNature | None
    description: str | None
    transaction_date: date
    account_id: uuid.UUID | None
    category_id: uuid.UUID
    notes: str | None
    source: TransactionSource
    nature_source: NatureSource | None
    receipt_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransactionList(BaseModel):
    items: list[TransactionRead]
    total: int
    page: int
    page_size: int
