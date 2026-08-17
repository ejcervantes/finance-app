import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class SummaryReport(BaseModel):
    # period = {"from": date, "to": date}
    period: dict
    total_income: Decimal
    total_expense: Decimal
    balance: Decimal
    savings_rate: float | None


class CategoryReportItem(BaseModel):
    category_id: uuid.UUID
    category_name: str
    total: Decimal
    count: int


class NatureReportItem(BaseModel):
    nature: str
    total: Decimal
    count: int


class BudgetStatusItem(BaseModel):
    budget_id: uuid.UUID
    category_id: uuid.UUID
    category_name: str | None
    period: str
    window: dict
    budget: Decimal
    spent: Decimal
    remaining: Decimal
    percent_used: float | None
