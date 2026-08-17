import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, uuid_pk


class Receipt(Base, TimestampMixin):
    """Recibo escaneado: guarda la imagen y lo que la IA extrajo (crudo).
    Sirve para trazabilidad y para derivar transactions.nature_source."""

    __tablename__ = "receipts"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    # Extracción cruda de la IA: monto, fecha, categoría/naturaleza sugerida, etc.
    raw_extraction: Mapped[dict] = mapped_column(JSONB, nullable=False)
