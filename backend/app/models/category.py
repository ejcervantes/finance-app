import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, uuid_pk
from app.models.enums import ExpenseNature, TransactionType


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = uuid_pk()
    # user_id NULL => categoría del sistema (predefinida, visible para todos).
    # user_id = X  => categoría propia del usuario X.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # ingreso o gasto — filtra las categorías en el formulario según el tipo.
    # Reusa el tipo enum de Postgres `transaction_type` (mismos valores).
    type: Mapped[TransactionType] = mapped_column(
        SAEnum(TransactionType, name="transaction_type", create_type=False),
        nullable=False,
        server_default=TransactionType.expense.value,
    )
    # Naturaleza sugerida por defecto (solo para gastos; NULL en ingresos).
    default_nature: Mapped[ExpenseNature | None] = mapped_column(
        SAEnum(ExpenseNature, name="expense_nature", create_type=False),
        nullable=True,
    )
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    @property
    def is_system(self) -> bool:
        """True si es una categoría predefinida del sistema (sin dueño)."""
        return self.user_id is None
