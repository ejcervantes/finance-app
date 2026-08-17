# Importa todos los modelos para que Base.metadata los conozca
# (necesario para que Alembic detecte las tablas al autogenerar migraciones).
from app.models.account import Account
from app.models.assistant_message import AssistantMessage
from app.models.budget import Budget
from app.models.category import Category
from app.models.receipt import Receipt
from app.models.transaction import Transaction
from app.models.user import User

__all__ = [
    "Account",
    "AssistantMessage",
    "Budget",
    "Category",
    "Receipt",
    "Transaction",
    "User",
]
