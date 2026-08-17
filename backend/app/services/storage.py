"""Almacenamiento de archivos (imágenes de recibos).

En desarrollo usa disco local (montado por Docker). La interfaz permite
cambiar a almacenamiento de objetos (S3/MinIO) más adelante sin tocar la app.
"""

import os
import uuid
from abc import ABC, abstractmethod
from functools import lru_cache

from app.core.config import settings

# Extensiones por tipo MIME (evita nombres raros de mimetypes)
_EXT_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
}


class Storage(ABC):
    @abstractmethod
    async def save(self, data: bytes, mime_type: str) -> str:
        """Guarda los bytes y devuelve una URL/ruta para referenciar el archivo."""


class LocalStorage(Storage):
    def __init__(self, base_dir: str, url_prefix: str) -> None:
        self.base_dir = base_dir
        self.url_prefix = url_prefix.rstrip("/")
        os.makedirs(self.base_dir, exist_ok=True)

    async def save(self, data: bytes, mime_type: str) -> str:
        ext = _EXT_BY_MIME.get(mime_type, ".img")
        filename = f"{uuid.uuid4()}{ext}"
        path = os.path.join(self.base_dir, filename)
        with open(path, "wb") as f:
            f.write(data)
        return f"{self.url_prefix}/{filename}"


@lru_cache
def get_storage() -> Storage:
    return LocalStorage(settings.upload_dir, settings.upload_url_prefix)
