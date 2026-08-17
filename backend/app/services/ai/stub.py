"""Proveedor simulado. Se usa cuando no hay GEMINI_API_KEY, para poder
probar todo el flujo de escaneo sin llamar a un servicio externo."""

from datetime import date
from decimal import Decimal

from app.models.enums import ExpenseNature
from app.services.ai.base import (
    AIProvider,
    CategoryHint,
    ChatMessage,
    ReceiptExtraction,
    ToolExecutor,
    ToolSpec,
)


class StubProvider(AIProvider):
    async def extract_receipt(
        self,
        image_bytes: bytes,
        mime_type: str,
        categories: list[CategoryHint],
    ) -> ReceiptExtraction:
        # Elige "Comida" si existe; si no, la primera categoría disponible.
        chosen = next(
            (c for c in categories if c.name.lower() == "comida"),
            categories[0] if categories else None,
        )
        return ReceiptExtraction(
            amount=Decimal("12500.00"),
            transaction_date=date.today(),
            description="Compra de supermercado (demo sin IA real)",
            suggested_category_id=chosen.id if chosen else None,
            suggested_expense_nature=ExpenseNature.fixed,
            confidence=0.5,
            reasoning="Extracción simulada: configura GEMINI_API_KEY para usar IA real.",
            raw_items=["(demo) Leche", "(demo) Arroz", "(demo) Pollo"],
        )

    async def chat(
        self,
        system_instruction: str,
        history: list[ChatMessage],
        tools: list[ToolSpec],
        tool_executor: ToolExecutor,
    ) -> str:
        # Ejercita el tool-calling de verdad: consulta el resumen del mes.
        summary = await tool_executor("get_current_month_summary", {})
        income = summary.get("total_income", "0")
        expense = summary.get("total_expense", "0")
        balance = summary.get("balance", "0")
        rate = summary.get("savings_rate")
        rate_txt = f"{float(rate) * 100:.0f}%" if rate is not None else "n/d"
        return (
            f"(demo sin IA real) Este mes llevas ingresos por {income} y gastos "
            f"por {expense}, con un balance de {balance} (tasa de ahorro {rate_txt}). "
            "Configura GEMINI_API_KEY para consejos generados por IA."
        )

    async def complete(self, system_instruction: str, prompt: str) -> str:
        return f"(demo sin IA real)\n{prompt}"
