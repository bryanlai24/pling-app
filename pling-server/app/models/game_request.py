import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class RequestStatus(str, enum.Enum):
    open = "open"
    fulfilled = "fulfilled"


class GameRequest(Base):
    __tablename__ = "game_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    platform: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, name="request_status_enum"),
        nullable=False,
        default=RequestStatus.open,
        server_default="open",
    )

    requested_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # If fulfilled, which game was added
    fulfilled_game_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("games.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    requested_by: Mapped["User | None"] = relationship("User", foreign_keys=[requested_by_id])
    fulfilled_game: Mapped["Game | None"] = relationship("Game", foreign_keys=[fulfilled_game_id])
    votes: Mapped[list["GameRequestVote"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )


class GameRequestVote(Base):
    __tablename__ = "game_request_votes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("game_requests.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("request_id", "user_id", name="uq_game_request_vote"),
    )

    # Relationships
    request: Mapped["GameRequest"] = relationship(back_populates="votes")
    user: Mapped["User"] = relationship("User")
