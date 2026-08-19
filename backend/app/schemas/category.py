import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ExpenseNature, TransactionType


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: TransactionType
    default_nature: ExpenseNature | None = None
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=20)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    type: TransactionType | None = None
    default_nature: ExpenseNature | None = None
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=20)
    is_archived: bool | None = None


class CategoryRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    is_system: bool  # True si es predefinida (user_id NULL)
    name: str
    type: TransactionType
    default_nature: ExpenseNature | None
    icon: str | None
    color: str | None
    is_archived: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
