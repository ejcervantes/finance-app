import uuid
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import ExpenseNature

# Ejecuta una herramienta pedida por el LLM: (nombre, argumentos) -> resultado JSON.
ToolExecutor = Callable[[str, dict], Awaitable[dict]]


class AIProviderError(Exception):
    """Falla al comunicarse con el proveedor de IA (auth, API deshabilitada,
    respuesta inválida, red, etc.). Se traduce a un 502 en la API."""


class CategoryHint(BaseModel):
    """Categoría disponible que se le ofrece a la IA para que elija una."""

    id: uuid.UUID
    name: str


class ReceiptExtraction(BaseModel):
    """Lo que la IA extrae de un recibo. Todo es una SUGERENCIA; el usuario
    confirma antes de que se cree la transacción."""

    amount: Decimal | None = None
    transaction_date: date | None = None
    description: str | None = None
    suggested_category_id: uuid.UUID | None = None
    suggested_expense_nature: ExpenseNature | None = None
    confidence: float | None = None
    reasoning: str | None = None
    raw_items: list[str] = []


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ToolSpec(BaseModel):
    """Herramienta (sin parámetros) que el asesor puede invocar. Cada una
    consulta datos reales del usuario en la BD vía el ToolExecutor."""

    name: str
    description: str


class AIProvider(ABC):
    @abstractmethod
    async def extract_receipt(
        self,
        image_bytes: bytes,
        mime_type: str,
        categories: list[CategoryHint],
    ) -> ReceiptExtraction:
        """Analiza la imagen del recibo y devuelve un borrador de transacción.
        NO desglosa la lista en varias transacciones: decide la naturaleza
        general del gasto (fijo/variable/discrecional)."""

    @abstractmethod
    async def chat(
        self,
        system_instruction: str,
        history: list[ChatMessage],
        tools: list[ToolSpec],
        tool_executor: ToolExecutor,
    ) -> str:
        """Conversa con el usuario. El LLM puede pedir herramientas (reportes)
        para responder con números reales; NO inventa cifras."""

    @abstractmethod
    async def complete(self, system_instruction: str, prompt: str) -> str:
        """Generación simple de texto (sin herramientas). Se usa para redactar
        los insights proactivos a partir de señales ya calculadas."""
