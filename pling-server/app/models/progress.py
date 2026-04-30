import uuid
from datetime import datetime
from sqlalchemy import DateTime, func, ForeignKey, Integer, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class GameStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"
    platinum = "platinum"
    full_completion = "full_completion"


class UserGame(Base):
    __tablename__ = "user_games"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    game_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[GameStatus] = mapped_column(
        Enum(GameStatus, name="game_status_enum"),
        default=GameStatus.not_started,
        nullable=False,
    )
    completion_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Xbox-specific — null for PSN/Steam/manual
    gamerscore_earned: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gamerscore_total: Mapped[int | None] = mapped_column(Integer, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="user_games")
    game: Mapped["Game"] = relationship(back_populates="user_games")