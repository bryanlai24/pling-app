import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, delete
from sqlalchemy.orm import selectinload

from app.models.genre import Genre, GameGenres
from app.models.game import Game
from app.schemas.genre import GenreCreate


async def create_genre(db: AsyncSession, data: GenreCreate) -> Genre:
    genre = Genre(**data.model_dump())
    db.add(genre)
    await db.flush()
    await db.refresh(genre)
    return genre


async def list_genres(db: AsyncSession) -> list[Genre]:
    result = await db.execute(select(Genre).order_by(Genre.genre))
    return list(result.scalars().all())


async def map_game_genres(db: AsyncSession, game_id: uuid.UUID, genre_ids: list[uuid.UUID]) -> None:
    # Remove existing genres
    await db.execute(delete(GameGenres).where(GameGenres.game_id == game_id))

    # Add new genres
    for genre_id in genre_ids:
        await db.execute(
            insert(GameGenres).values(game_id=game_id, genre_id=genre_id)
        )


async def update_game_genres(db: AsyncSession, game_id: uuid.UUID, genre_ids: list[uuid.UUID]) -> Game:
    await map_game_genres(db, game_id, genre_ids)
    result = await db.execute(
        select(Game)
        .where(Game.id == game_id)
        .options(selectinload(Game.game_genres))
    )
    return result.scalar_one()


async def list_games_by_genre(db: AsyncSession, genre_id: uuid.UUID) -> list[Game]:
    result = await db.execute(
        select(Game)
        .join(GameGenres, GameGenres.game_id == Game.id)
        .where(GameGenres.genre_id == genre_id)
        .options(selectinload(Game.game_genres))
        .order_by(Game.title)
    )
    return list(result.scalars().all())
