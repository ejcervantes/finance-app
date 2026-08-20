"""Proveedor de IA con Google Gemini Flash (multimodal / visión).

Requiere el paquete `google-genai` y GEMINI_API_KEY. La llamada se hace con el
cliente asíncrono para no bloquear el event loop.
"""

import json
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation

from app.core.config import settings
from app.models.enums import ExpenseNature, TransactionType
from app.services.ai.base import (
    AIProvider,
    AIProviderError,
    CategoryHint,
    ChatMessage,
    ReceiptExtraction,
    StatementItem,
    ToolExecutor,
    ToolSpec,
)

_MAX_TOOL_TURNS = 6

_SYSTEM_INSTRUCTION = (
    "Eres un asistente que analiza fotos de recibos/boletas de compra para una "
    "app de finanzas personales. Extraes el TOTAL, la fecha y una descripción "
    "breve del comercio. NO desgloses la compra en varias transacciones: es UNA "
    "sola transacción. Decides la naturaleza GENERAL del gasto según la mayoría "
    "de los productos:\n"
    "- 'fixed': esenciales (comida básica, higiene, medicinas, servicios).\n"
    "- 'variable': necesarios pero no fijos (gasolina, ferretería).\n"
    "- 'discretionary': prescindibles (mayoría alcohol, snacks, dulces, antojos).\n"
    "Eliges la categoría que mejor encaje de la lista dada (o null si ninguna). "
    "Respondes SOLO con JSON válido, sin texto adicional."
)


def _build_prompt(categories: list[CategoryHint]) -> str:
    cat_lines = "\n".join(f"- {c.id}: {c.name}" for c in categories) or "(ninguna)"
    return (
        "Categorías disponibles (usa el id exacto):\n"
        f"{cat_lines}\n\n"
        "Devuelve un JSON con esta forma exacta:\n"
        "{\n"
        '  "amount": number,               // total del recibo\n'
        '  "transaction_date": "YYYY-MM-DD",\n'
        '  "description": string,          // nombre del comercio o resumen\n'
        '  "suggested_category_id": string|null,  // uno de los ids de arriba\n'
        '  "suggested_expense_nature": "fixed"|"variable"|"discretionary",\n'
        '  "confidence": number,           // 0.0 a 1.0\n'
        '  "reasoning": string,            // breve, en español\n'
        '  "items": [string]               // productos detectados (solo referencia)\n'
        "}"
    )


_STATEMENT_SYSTEM = (
    "Eres un asistente que lee estados de cuenta bancarios en PDF para una app de "
    "finanzas personales. Extraes TODOS los movimientos, uno por transacción, "
    "respetando el orden del documento. Para cada movimiento:\n"
    "- 'type': 'income' si es un crédito/depósito/abono; 'expense' si es un "
    "débito/cargo/compra/retiro/pago.\n"
    "- 'amount': monto SIEMPRE positivo (sin signo).\n"
    "- eliges la categoría que mejor encaje de la lista (respetando el tipo), o null.\n"
    "- para gastos, decides la naturaleza (fixed/variable/discretionary); para "
    "ingresos va null.\n"
    "No inventes movimientos. Si el PDF no es un estado de cuenta o no hay "
    "movimientos, devuelves una lista vacía. Respondes SOLO con JSON válido."
)


def _build_statement_prompt(categories: list[CategoryHint]) -> str:
    cat_lines = (
        "\n".join(f"- {c.id}: {c.name} ({c.type or 'expense'})" for c in categories)
        or "(ninguna)"
    )
    return (
        "Categorías disponibles (usa el id exacto; respeta el tipo):\n"
        f"{cat_lines}\n\n"
        "Devuelve un JSON con esta forma exacta:\n"
        '{ "items": [ {\n'
        '  "type": "income"|"expense",\n'
        '  "amount": number,                      // positivo\n'
        '  "transaction_date": "YYYY-MM-DD",\n'
        '  "description": string,\n'
        '  "suggested_category_id": string|null,\n'
        '  "suggested_expense_nature": "fixed"|"variable"|"discretionary"|null\n'
        "} ] }"
    )


class GeminiProvider(AIProvider):
    def __init__(self) -> None:
        # Import perezoso: solo se necesita si de verdad se usa Gemini.
        from google import genai

        self._genai = genai
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_model

    async def _generate(self, **kwargs):
        """Llama a Gemini traduciendo cualquier fallo a AIProviderError."""
        from google.genai import errors

        try:
            return await self._client.aio.models.generate_content(**kwargs)
        except errors.APIError as e:
            raise AIProviderError(
                f"Gemini ({getattr(e, 'code', '?')}): {getattr(e, 'message', str(e))}"
            ) from e
        except Exception as e:  # red, timeout, etc.
            raise AIProviderError(f"Fallo al contactar a Gemini: {e}") from e

    async def extract_receipt(
        self,
        image_bytes: bytes,
        mime_type: str,
        categories: list[CategoryHint],
    ) -> ReceiptExtraction:
        from google.genai import types

        response = await self._generate(
            model=self._model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                _build_prompt(categories),
            ],
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        try:
            data = json.loads(response.text)
        except (json.JSONDecodeError, TypeError) as e:
            raise AIProviderError(f"Respuesta de Gemini no es JSON válido: {e}") from e
        return _parse(data, categories)

    async def extract_statement(
        self,
        pdf_bytes: bytes,
        mime_type: str,
        categories: list[CategoryHint],
    ) -> list[StatementItem]:
        from google.genai import types

        response = await self._generate(
            model=self._model,
            contents=[
                types.Part.from_bytes(data=pdf_bytes, mime_type=mime_type),
                _build_statement_prompt(categories),
            ],
            config=types.GenerateContentConfig(
                system_instruction=_STATEMENT_SYSTEM,
                response_mime_type="application/json",
                temperature=0.0,
            ),
        )
        try:
            data = json.loads(response.text)
        except (json.JSONDecodeError, TypeError) as e:
            raise AIProviderError(f"Respuesta de Gemini no es JSON válido: {e}") from e
        raw_items = data.get("items") if isinstance(data, dict) else data
        if not isinstance(raw_items, list):
            raw_items = []
        valid_ids = {str(c.id) for c in categories}
        return [_parse_statement_item(it, valid_ids) for it in raw_items if isinstance(it, dict)]

    async def chat(
        self,
        system_instruction: str,
        history: list[ChatMessage],
        tools: list[ToolSpec],
        tool_executor: ToolExecutor,
    ) -> str:
        from google.genai import types

        fdecls = [
            types.FunctionDeclaration(
                name=t.name,
                description=t.description,
                parameters=types.Schema(type=types.Type.OBJECT, properties={}),
            )
            for t in tools
        ]
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=[types.Tool(function_declarations=fdecls)],
            temperature=0.3,
        )

        contents = [
            types.Content(
                role="user" if m.role == "user" else "model",
                parts=[types.Part.from_text(text=m.content)],
            )
            for m in history
        ]

        for _ in range(_MAX_TOOL_TURNS):
            response = await self._generate(
                model=self._model, contents=contents, config=config
            )
            candidate = response.candidates[0]
            parts = candidate.content.parts or []
            calls = [p.function_call for p in parts if getattr(p, "function_call", None)]

            if not calls:
                return response.text or "No pude generar una respuesta."

            contents.append(candidate.content)  # turno con las llamadas del modelo
            for call in calls:
                result = await tool_executor(call.name, dict(call.args or {}))
                contents.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=call.name, response=result
                            )
                        ],
                    )
                )

        return "No pude completar la respuesta (demasiadas consultas encadenadas)."

    async def complete(self, system_instruction: str, prompt: str) -> str:
        from google.genai import types

        response = await self._generate(
            model=self._model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction, temperature=0.4
            ),
        )
        return response.text or ""


def _parse_statement_item(data: dict, valid_ids: set[str]) -> StatementItem:
    """Convierte un movimiento del JSON de Gemini en StatementItem (defensivo)."""
    tx_type = TransactionType.income if data.get("type") == "income" else TransactionType.expense

    amount = None
    try:
        if data.get("amount") is not None:
            amount = abs(Decimal(str(data["amount"])).quantize(Decimal("0.01")))
    except (InvalidOperation, ValueError):
        amount = None

    tx_date = None
    try:
        if data.get("transaction_date"):
            tx_date = date.fromisoformat(str(data["transaction_date"]))
    except (ValueError, TypeError):
        tx_date = None

    cat_id = None
    raw_cat = data.get("suggested_category_id")
    if raw_cat and str(raw_cat) in valid_ids:
        cat_id = uuid.UUID(str(raw_cat))

    nature = None
    if tx_type == TransactionType.expense:
        raw_nature = data.get("suggested_expense_nature")
        if raw_nature in {n.value for n in ExpenseNature}:
            nature = ExpenseNature(raw_nature)

    return StatementItem(
        type=tx_type,
        amount=amount,
        transaction_date=tx_date,
        description=(data.get("description") or None),
        suggested_category_id=cat_id,
        suggested_expense_nature=nature,
    )


def _parse(data: dict, categories: list[CategoryHint]) -> ReceiptExtraction:
    """Convierte el JSON de Gemini en ReceiptExtraction de forma defensiva."""
    valid_ids = {str(c.id) for c in categories}

    amount = None
    try:
        if data.get("amount") is not None:
            amount = Decimal(str(data["amount"])).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        amount = None

    tx_date = None
    try:
        if data.get("transaction_date"):
            tx_date = date.fromisoformat(data["transaction_date"])
    except (ValueError, TypeError):
        tx_date = None

    cat_id = None
    raw_cat = data.get("suggested_category_id")
    if raw_cat and str(raw_cat) in valid_ids:
        cat_id = uuid.UUID(str(raw_cat))

    nature = None
    raw_nature = data.get("suggested_expense_nature")
    if raw_nature in {n.value for n in ExpenseNature}:
        nature = ExpenseNature(raw_nature)

    confidence = None
    try:
        if data.get("confidence") is not None:
            confidence = max(0.0, min(1.0, float(data["confidence"])))
    except (ValueError, TypeError):
        confidence = None

    items = data.get("items") or []
    if not isinstance(items, list):
        items = []

    return ReceiptExtraction(
        amount=amount,
        transaction_date=tx_date,
        description=(data.get("description") or None),
        suggested_category_id=cat_id,
        suggested_expense_nature=nature,
        confidence=confidence,
        reasoning=(data.get("reasoning") or None),
        raw_items=[str(i) for i in items],
    )
