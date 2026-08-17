import os

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.services.ai.base import AIProviderError

app = FastAPI(title=settings.project_name)


@app.exception_handler(AIProviderError)
async def ai_provider_error_handler(
    request: Request, exc: AIProviderError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={"detail": f"El servicio de IA no está disponible: {exc}"},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)

# Sirve las imágenes de recibos guardadas en disco (dev).
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount(
    settings.upload_url_prefix,
    StaticFiles(directory=settings.upload_dir),
    name="uploads",
)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
