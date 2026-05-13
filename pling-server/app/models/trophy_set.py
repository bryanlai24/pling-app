import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class TrophySet(Base):
    __tablename__ = "trophy_sets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    game_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g. "Base Game", "Deluxe Edition DLC"
    platform_communication_id: Mapped[str | None] = mapped_column(String(255), nullable=True)  # npCommunicationId
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    gamerscore_total: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    game: Mapped["Game"] = relationship(back_populates="trophy_sets")
    achievements: Mapped[list["Achievement"]] = relationship(
        back_populates="trophy_set", cascade="all, delete-orphan"
    )