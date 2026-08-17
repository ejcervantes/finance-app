"""Capa de abstracción de IA.

`get_ai_provider()` devuelve el proveedor activo:
- GeminiProvider si hay GEMINI_API_KEY configurada.
- StubProvider (datos simulados) en caso contrario, para desarrollo y pruebas.
"""

from functools import lru_cache

from app.core.config import settings
from app.services.ai.base import AIProvider


@lru_cache
def get_ai_provider() -> AIProvider:
    if settings.gemini_api_key:
        from app.services.ai.gemini import GeminiProvider

        return GeminiProvider()

    from app.services.ai.stub import StubProvider

    return StubProvider()
