"""
Seed all 14 genres directly into the database.
Usage: docker compose exec server python seed_genres.py
"""
import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, text

DATABASE_URL = "postgresql+asyncpg://postgres:password@db:5432/pling"

GENRES = [
    "action", "adventure", "rpg", "strategy", "simulation",
    "sports", "racing", "puzzle", "horror", "platformer",
    "fighting", "shooter", "mmorpg", "rhythm",
]

async def main():
    engine = create_async_engine(DATABASE_URL)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        created, skipped = 0, 0
        for genre in GENRES:
            existing = await db.execute(
                text("SELECT id FROM genres WHERE genre = :genre"),
                {"genre": genre}
            )
            if existing.scalar_one_or_none():
                print(f"  ~ {genre} (already exists)")
                skipped += 1
            else:
                await db.execute(
                    text("INSERT INTO genres (id, genre) VALUES (:id, :genre)"),
                    {"id": str(uuid.uuid4()), "genre": genre}
                )
                print(f"  ✓ {genre}")
                created += 1
        await db.commit()

    await engine.dispose()
    print(f"\nDone — {created} created, {skipped} skipped.")

asyncio.run(main())
