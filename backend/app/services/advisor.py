"""Asesor de finanzas con IA.

- chat(): conversacional con tool-calling sobre los reportes (números reales).
- insights(): proactivo híbrido — reglas deterministas detectan señales,
  la IA las redacta como consejos.

Barreras (reglas fijas del sistema): puede recomendar gastar menos, ahorrar más
o que en general es buena idea invertir/ahorrar; NO recomienda instrumentos
específicos; SIEMPRE sugiere consultar a un profesional para inversiones.
"""

import calendar
import json
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assistant_message import AssistantMessage
from app.models.enums import MessageRole, TransactionType
from app.services import reports
from app.services.ai import get_ai_provider
from app.services.ai.base import ChatMessage, ToolExecutor, ToolSpec

_GUARDRAILS = (
    "Eres un asesor de finanzas personales dentro de una app. Das consejos claros "
    "y accionables sobre gastos y ahorro, en español, con tono cercano y breve. "
    "REGLAS INQUEBRANTABLES:\n"
    "- Puedes sugerir gastar menos, ahorrar más, o que en general es buena idea "
    "ahorrar o invertir.\n"
    "- NUNCA recomiendas instrumentos de inversión específicos (acciones, cripto, "
    "fondos concretos).\n"
    "- Para decisiones de inversión, SIEMPRE sugieres consultar a un profesional "
    "certificado.\n"
    "- Basas tus afirmaciones numéricas SOLO en los datos de las herramientas; "
    "nunca inventas cifras."
)

_CHAT_SYSTEM = _GUARDRAILS + (
    "\nUsa las herramientas disponibles para obtener los datos del usuario antes "
    "de dar cifras. Si no hay datos, dilo con naturalidad."
    "\nEVALUAR UNA COMPRA ('¿me alcanza para X?'): "
    "si es una compra PEQUEÑA, mira el balance y los gastos del mes actual y di si "
    "cabe sin desbalancear el mes. Si es una compra GRANDE (ej. un carro, un viaje), "
    "usa `get_savings_trend` para ver cuánto ahorra en promedio por mes, a cuántos "
    "meses de ahorro equivale la compra, y qué tan cómodamente podría asumirla "
    "(de golpe vs. ahorrando unos meses). Sé concreto con cifras y honesto si es "
    "arriesgado. Mantén las barreras: nada de instrumentos de inversión específicos."
    "\nFORMATO: responde en texto plano. Puedes usar **negritas** y listas "
    "numeradas, pero NO uses encabezados markdown (nada de ###) ni líneas "
    "separadoras (nada de ---)."
)

_INSIGHTS_SYSTEM = _GUARDRAILS + (
    "\nRecibirás una lista de señales ya calculadas sobre el mes en curso. "
    "Conviértelas en 2 a 4 consejos breves, cálidos y accionables. No repitas las "
    "señales literalmente; dales contexto útil."
)

TOOLS = [
    ToolSpec(
        name="get_current_month_summary",
        description="Ingresos, gastos, balance y tasa de ahorro del mes en curso.",
    ),
    ToolSpec(
        name="get_spending_by_category",
        description="Gasto del mes en curso agrupado por categoría.",
    ),
    ToolSpec(
        name="get_expense_nature_breakdown",
        description="Gasto del mes por naturaleza: fijo, variable, discrecional, sin clasificar.",
    ),
    ToolSpec(
        name="get_budget_status",
        description="Estado de los presupuestos: cuánto se ha gastado vs. el tope.",
    ),
    ToolSpec(
        name="get_savings_trend",
        description=(
            "Ingresos, gastos, balance y ahorro acumulado por mes de los últimos 12 "
            "meses. Úsalo para evaluar capacidad de ahorro y compras grandes."
        ),
    ),
]


def _month_range(ref: date) -> tuple[date, date]:
    last = calendar.monthrange(ref.year, ref.month)[1]
    return ref.replace(day=1), ref.replace(day=last)


def _jsonable(obj):
    """Convierte Decimals/dates/uuids a tipos JSON para enviar al LLM."""
    return json.loads(json.dumps(obj, default=str))


def make_tool_executor(db: AsyncSession, user_id: uuid.UUID) -> ToolExecutor:
    async def execute(name: str, args: dict) -> dict:
        today = date.today()
        df, dt = _month_range(today)
        if name == "get_current_month_summary":
            return _jsonable(await reports.summary(db, user_id, df, dt))
        if name == "get_spending_by_category":
            return {
                "items": _jsonable(
                    await reports.by_category(
                        db, user_id, df, dt, TransactionType.expense
                    )
                )
            }
        if name == "get_expense_nature_breakdown":
            return {"items": _jsonable(await reports.by_nature(db, user_id, df, dt))}
        if name == "get_budget_status":
            return {
                "items": _jsonable(await reports.budgets_status(db, user_id, today))
            }
        if name == "get_savings_trend":
            return {"items": _jsonable(await reports.trend(db, user_id, 12))}
        return {"error": f"herramienta desconocida: {name}"}

    return execute


async def _load_history(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 20
) -> list[ChatMessage]:
    rows = (
        await db.scalars(
            select(AssistantMessage)
            .where(AssistantMessage.user_id == user_id)
            .order_by(AssistantMessage.created_at.desc())
            .limit(limit)
        )
    ).all()
    rows = list(reversed(rows))  # cronológico
    return [
        ChatMessage(
            role="user" if r.role == MessageRole.user else "assistant",
            content=r.content,
        )
        for r in rows
    ]


async def chat(db: AsyncSession, user_id: uuid.UUID, message: str) -> str:
    history = await _load_history(db, user_id)
    history.append(ChatMessage(role="user", content=message))

    reply = await get_ai_provider().chat(
        _CHAT_SYSTEM, history, TOOLS, make_tool_executor(db, user_id)
    )

    db.add(AssistantMessage(user_id=user_id, role=MessageRole.user, content=message))
    db.add(
        AssistantMessage(
            user_id=user_id, role=MessageRole.assistant, content=reply
        )
    )
    await db.commit()
    return reply


async def insights(db: AsyncSession, user_id: uuid.UUID) -> dict:
    today = date.today()
    df, dt = _month_range(today)

    summary = await reports.summary(db, user_id, df, dt)
    budgets = await reports.budgets_status(db, user_id, today)
    nature = await reports.by_nature(db, user_id, df, dt)
    categories = await reports.by_category(
        db, user_id, df, dt, TransactionType.expense
    )

    signals: list[str] = []

    rate = summary["savings_rate"]
    if rate is not None and rate < 0:
        signals.append("Estás gastando más de lo que ingresas este mes.")

    for b in budgets:
        pct = b["percent_used"]
        if pct is not None and pct >= 0.85:
            signals.append(
                f"Vas al {pct * 100:.0f}% del presupuesto de {b['category_name']}."
            )

    total_expense = summary["total_expense"]
    discretionary = next(
        (item["total"] for item in nature if item["nature"] == "discretionary"),
        None,
    )
    if total_expense and total_expense > 0 and discretionary is not None:
        share = float(discretionary) / float(total_expense)
        if share > 0.30:
            signals.append(
                f"El gasto discrecional (prescindible) es el {share * 100:.0f}% "
                "de tus gastos del mes."
            )

    for c in categories:
        if "restaurante" in c["category_name"].lower() and c["count"] >= 3:
            signals.append(
                f"Llevas {c['count']} salidas a comer este mes (total {c['total']})."
            )

    if not signals:
        signals.append("Vas bien: sin alertas de gasto relevantes este mes.")

    prompt = "Señales detectadas:\n- " + "\n- ".join(signals)
    advice = await get_ai_provider().complete(_INSIGHTS_SYSTEM, prompt)

    return {"signals": signals, "advice": advice}
