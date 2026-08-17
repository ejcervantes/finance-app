import calendar
from datetime import date

from fastapi import APIRouter

from app.deps import CurrentUser, DbSession
from app.models.enums import TransactionType
from app.schemas.report import (
    BudgetStatusItem,
    CategoryReportItem,
    NatureReportItem,
    SummaryReport,
)
from app.services import reports

router = APIRouter(prefix="/reports", tags=["reports"])


def _default_month_range() -> tuple[date, date]:
    """Mes calendario actual [primer día, último día]."""
    today = date.today()
    last_day = calendar.monthrange(today.year, today.month)[1]
    return today.replace(day=1), today.replace(day=last_day)


@router.get("/summary", response_model=SummaryReport)
async def report_summary(
    current_user: CurrentUser,
    db: DbSession,
    date_from: date | None = None,
    date_to: date | None = None,
) -> SummaryReport:
    default_from, default_to = _default_month_range()
    result = await reports.summary(
        db, current_user.id, date_from or default_from, date_to or default_to
    )
    return SummaryReport(**result)


@router.get("/by-category", response_model=list[CategoryReportItem])
async def report_by_category(
    current_user: CurrentUser,
    db: DbSession,
    date_from: date | None = None,
    date_to: date | None = None,
    type: TransactionType = TransactionType.expense,
) -> list[dict]:
    default_from, default_to = _default_month_range()
    return await reports.by_category(
        db, current_user.id, date_from or default_from, date_to or default_to, type
    )


@router.get("/by-nature", response_model=list[NatureReportItem])
async def report_by_nature(
    current_user: CurrentUser,
    db: DbSession,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    default_from, default_to = _default_month_range()
    return await reports.by_nature(
        db, current_user.id, date_from or default_from, date_to or default_to
    )


@router.get("/budgets", response_model=list[BudgetStatusItem])
async def report_budgets(
    current_user: CurrentUser,
    db: DbSession,
    ref_date: date | None = None,
) -> list[dict]:
    return await reports.budgets_status(
        db, current_user.id, ref_date or date.today()
    )
