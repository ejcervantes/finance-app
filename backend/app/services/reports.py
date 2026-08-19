"""Lógica de cálculo de reportes. Los números salen SIEMPRE de la BD
(sumas exactas con Decimal), no se almacenan (ver decisión 9)."""

import calendar
import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.category import Category
from app.models.enums import BudgetPeriod, TransactionType
from app.models.transaction import Transaction

ZERO = Decimal("0.00")


def period_window(period: BudgetPeriod, ref: date) -> tuple[date, date]:
    """Ventana [inicio, fin] del período que contiene a `ref`."""
    if period == BudgetPeriod.weekly:
        start = ref - timedelta(days=ref.weekday())  # lunes
        return start, start + timedelta(days=6)
    if period == BudgetPeriod.monthly:
        last_day = calendar.monthrange(ref.year, ref.month)[1]
        return ref.replace(day=1), ref.replace(day=last_day)
    # yearly
    return ref.replace(month=1, day=1), ref.replace(month=12, day=31)


async def summary(
    db: AsyncSession, user_id: uuid.UUID, date_from: date, date_to: date
) -> dict:
    stmt = (
        select(Transaction.type, func.coalesce(func.sum(Transaction.amount), ZERO))
        .where(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= date_from,
            Transaction.transaction_date <= date_to,
        )
        .group_by(Transaction.type)
    )
    totals = {t: amt for t, amt in (await db.execute(stmt)).all()}
    income = totals.get(TransactionType.income, ZERO)
    expense = totals.get(TransactionType.expense, ZERO)
    balance = income - expense
    savings_rate = float(balance / income) if income > 0 else None

    return {
        "period": {"from": date_from, "to": date_to},
        "total_income": income,
        "total_expense": expense,
        "balance": balance,
        "savings_rate": savings_rate,
    }


async def by_category(
    db: AsyncSession,
    user_id: uuid.UUID,
    date_from: date,
    date_to: date,
    tx_type: TransactionType,
) -> list[dict]:
    total = func.sum(Transaction.amount)
    stmt = (
        select(Category.id, Category.name, total, func.count())
        .join(Transaction, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.type == tx_type,
            Transaction.transaction_date >= date_from,
            Transaction.transaction_date <= date_to,
        )
        .group_by(Category.id, Category.name)
        .order_by(total.desc())
    )
    return [
        {"category_id": cid, "category_name": name, "total": amt, "count": cnt}
        for cid, name, amt, cnt in (await db.execute(stmt)).all()
    ]


async def by_nature(
    db: AsyncSession, user_id: uuid.UUID, date_from: date, date_to: date
) -> list[dict]:
    """Desglose de GASTOS por naturaleza (fijo/variable/discrecional/sin clasificar)."""
    total = func.sum(Transaction.amount)
    stmt = (
        select(Transaction.expense_nature, total, func.count())
        .where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.expense,
            Transaction.transaction_date >= date_from,
            Transaction.transaction_date <= date_to,
        )
        .group_by(Transaction.expense_nature)
    )
    return [
        {
            "nature": nature.value if nature is not None else "unclassified",
            "total": amt,
            "count": cnt,
        }
        for nature, amt, cnt in (await db.execute(stmt)).all()
    ]


async def trend(
    db: AsyncSession, user_id: uuid.UUID, months: int = 6
) -> list[dict]:
    """Ingresos/gastos/balance por mes de los últimos `months`, con acumulado."""
    today = date.today()
    ym: list[tuple[int, int]] = []
    for i in range(months - 1, -1, -1):
        mm, yy = today.month - i, today.year
        while mm <= 0:
            mm += 12
            yy -= 1
        ym.append((yy, mm))

    start = date(ym[0][0], ym[0][1], 1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    end = today.replace(day=last_day)

    month_col = func.date_trunc("month", Transaction.transaction_date)
    stmt = (
        select(month_col.label("m"), Transaction.type, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
        )
        .group_by("m", Transaction.type)
    )
    agg: dict[tuple[int, int], dict] = {}
    for m, ttype, total in (await db.execute(stmt)).all():
        agg.setdefault((m.year, m.month), {})[ttype] = total or ZERO

    # Ahorro acumulado antes de la ventana (para arrancar la línea acumulada).
    net_before = case(
        (Transaction.type == TransactionType.income, Transaction.amount),
        else_=-Transaction.amount,
    )
    base = await db.scalar(
        select(func.coalesce(func.sum(net_before), ZERO)).where(
            Transaction.user_id == user_id, Transaction.transaction_date < start
        )
    )

    results: list[dict] = []
    cumulative = Decimal(base or 0)
    for yy, mm in ym:
        income = agg.get((yy, mm), {}).get(TransactionType.income, ZERO)
        expense = agg.get((yy, mm), {}).get(TransactionType.expense, ZERO)
        balance = income - expense
        cumulative += balance
        results.append(
            {
                "month": f"{yy}-{mm:02d}",
                "income": income,
                "expense": expense,
                "balance": balance,
                "cumulative": cumulative,
            }
        )
    return results


async def budgets_status(
    db: AsyncSession, user_id: uuid.UUID, ref: date
) -> list[dict]:
    """Para cada presupuesto: gasto ejecutado en la ventana de su propio período."""
    budgets = (
        await db.scalars(
            select(Budget).where(Budget.user_id == user_id)
        )
    ).all()

    results: list[dict] = []
    for b in budgets:
        start, end = period_window(b.period, ref)
        spent = await db.scalar(
            select(func.coalesce(func.sum(Transaction.amount), ZERO)).where(
                Transaction.user_id == user_id,
                Transaction.category_id == b.category_id,
                Transaction.type == TransactionType.expense,
                Transaction.transaction_date >= start,
                Transaction.transaction_date <= end,
            )
        )
        category = await db.get(Category, b.category_id)
        remaining = b.amount - spent
        percent_used = float(spent / b.amount) if b.amount > 0 else None
        results.append(
            {
                "budget_id": b.id,
                "category_id": b.category_id,
                "category_name": category.name if category else None,
                "period": b.period.value,
                "window": {"from": start, "to": end},
                "budget": b.amount,
                "spent": spent,
                "remaining": remaining,
                "percent_used": percent_used,
            }
        )
    return results
