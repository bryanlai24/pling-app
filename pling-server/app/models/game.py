import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.associationproxy import association_proxy, AssociationProxy
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class Platform(str, enum.Enum):
    psn = "psn"
    xbox = "xbox"
    steam = "steam"
    manual = "manual"


class Game(Base):
    __tablename__ = "games"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    platform: Mapped[Platform] = mapped_column(
        Enum(Platform, name="platform_enum"), nullable=False
    )
    platform_game_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    achievements: Mapped[list["Achievement"]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )
    trophy_sets: Mapped[list["TrophySet"]] = relationship(
        back_populates="game",
        cascade="all, delete-orphan",
        order_by="TrophySet.sort_order"
    )
    user_games: Mapped[list["UserGame"]] = relationship(back_populates="game")
    game_genres: Mapped[list["GameGenres"]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )
    genres: AssociationProxy[list["Genre"]] = association_proxy("game_genres", "genre")