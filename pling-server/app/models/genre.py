import uuid
from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class BaseGenre(str, enum.Enum):
    action = "action"
    adventure = "adventure"
    rpg = "rpg"
    strategy = "strategy"
    simulation = "simulation"
    sports = "sports"
    racing = "racing"
    puzzle = "puzzle"
    horror = "horror"
    platformer = "platformer"
    fighting = "fighting"
    shooter = "shooter"
    mmorpg = "mmorpg"
    rhythm = "rhythm"


class SubGenre(str, enum.Enum):
    open_world = "open world"
    roguelike = "roguelike"
    metroidvania = "metroidvania"
    soulslike = "soulslike"
    battle_royale = "battle royale"
    sandbox = "sandbox"
    visual_novel = "visual novel"
    co_op = "co-op"
    survival = "survival"


class Genre(Base):
    __tablename__ = "genres"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    genre: Mapped[BaseGenre] = mapped_column(
        Enum(BaseGenre, name="base_genre_enum"), nullable=False, unique=True
    )

    # Relationships
    game_genres: Mapped[list["GameGenres"]] = relationship(back_populates="genre")


class GameGenres(Base):
    __tablename__ = "game_genres"

    game_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"), primary_key=True
    )
    genre_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True
    )

    # Relationships
    game: Mapped["Game"] = relationship(back_populates="game_genres")
    genre: Mapped["Genre"] = relationship(back_populates="game_genres")
