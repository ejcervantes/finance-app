from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración de la app. Los valores se leen de variables de entorno
    (las inyecta docker-compose) o de un archivo .env para desarrollo local."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    project_name: str = "Finance Calc API"
    api_v1_prefix: str = "/api/v1"

    # Base de datos (async con asyncpg)
    database_url: str = "postgresql+asyncpg://finance:finance@localhost:5432/finance"

    # Seguridad / JWT
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # IA (escaneo de recibos y asesor)
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.6-flash"  # modelo Flash; configurable vía GEMINI_MODEL

    # Almacenamiento de imágenes (recibos). En dev: disco local montado.
    upload_dir: str = "/code/uploads"
    upload_url_prefix: str = "/uploads"
    max_upload_mb: int = 10

    # CORS: orígenes permitidos para los frontends (en dev, todos)
    cors_origins: list[str] = ["*"]

    @field_validator("database_url")
    @classmethod
    def _use_asyncpg_driver(cls, v: str) -> str:
        """Render/Heroku entregan `postgres://` o `postgresql://`; SQLAlchemy
        async necesita el driver asyncpg explícito."""
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v


settings = Settings()
