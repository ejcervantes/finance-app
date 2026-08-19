"""categorias type y default_nature

Revision ID: 729d979b9a07
Revises: a01539f82857
Create Date: 2026-08-19 14:12:38.821437

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '729d979b9a07'
down_revision: Union[str, None] = 'a01539f82857'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Reusa los tipos enum de Postgres existentes (no los crea de nuevo).
    transaction_type = postgresql.ENUM(
        "income", "expense", name="transaction_type", create_type=False
    )
    expense_nature = postgresql.ENUM(
        "fixed", "variable", "discretionary", name="expense_nature", create_type=False
    )
    # type: NOT NULL con default 'expense' para rellenar filas existentes;
    # el seed corrige luego las categorías de ingreso.
    op.add_column(
        "categories",
        sa.Column("type", transaction_type, nullable=False, server_default="expense"),
    )
    op.add_column(
        "categories",
        sa.Column("default_nature", expense_nature, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("categories", "default_nature")
    op.drop_column("categories", "type")
