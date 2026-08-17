import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, uuid_pk
from app.models.enums import (
    ExpenseNature,
    NatureSource,
    TransactionSource,
    TransactionType,
)


class Transaction(Base, TimestampMixin):
    """Corazón del sistema: un ingreso o un gasto."""

    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[TransactionType] = mapped_column(
        SAEnum(TransactionType, name="transaction_type"), nullable=False
    )
    # Dinero EXACTO: nunca float. Se maneja con Decimal en Python.
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    # NULL cuando type == income
    expense_nature: Mapped[ExpenseNature | None] = mapped_column(
        SAEnum(ExpenseNature, name="expense_nature"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)

    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,  # opcional
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,  # obligatorio
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Procedencia del dato (manual vs escaneo con IA)
    source: Mapped[TransactionSource] = mapped_column(
        SAEnum(TransactionSource, name="transaction_source"),
        nullable=False,
        default=TransactionSource.manual,
    )
    nature_source: Mapped[NatureSource | None] = mapped_column(
        SAEnum(NatureSource, name="nature_source"), nullable=True
    )
    receipt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("receipts.id", ondelete="SET NULL"),
        nullable=True,
    )
