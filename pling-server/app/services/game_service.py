import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.game import Game
from app.models.progress import UserGame, GameStatus
from app.models.achievement import UserAchievement
from app.schemas.game import GameCreate, GameUpdate, UserGameCreate, UserGameUpdate


# ── Games ──────────────────────────────────────────────────────────────────────

async def create_game(db: AsyncSession, data: GameCreate) -> Game:
    game = Game(**data.model_dump())
    db.add(game)
    await db.flush()
    # Reload with relationships
    result = await db.execute(
        select(Game)
        .where(Game.id == game.id)
        .options(selectinload(Game.game_genres))
    )
    return result.scalar_one()


async def get_game(db: AsyncSession, game_id: uuid.UUID) -> Game:
    result = await db.execute(
        select(Game)
        .where(Game.id == game_id)
        .options(selectinload(Game.game_genres))
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    return game


async def list_games(db: AsyncSession, platform: str | None = None) -> list[Game]:
    q = select(Game).options(selectinload(Game.game_genres))
    if platform:
        q = q.where(Game.platform == platform)
    result = await db.execute(q.order_by(Game.title))
    return list(result.scalars().all())


async def update_game(db: AsyncSession, game_id: uuid.UUID, data: GameUpdate) -> Game:
    game = await get_game(db, game_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(game, field, value)
    await db.flush()
    await db.refresh(game)
    return game


async def delete_game(db: AsyncSession, game_id: uuid.UUID) -> None:
    game = await get_game(db, game_id)
    await db.delete(game)


# ── User-game tracking ─────────────────────────────────────────────────────────

async def add_game_to_library(
    db: AsyncSession, user_id: uuid.UUID, data: UserGameCreate
) -> UserGame:
    await get_game(db, data.game_id)

    existing = await db.execute(
        select(UserGame).where(
            UserGame.user_id == user_id,
            UserGame.game_id == data.game_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This game is already in your library",
        )

    # Get gamerscore total from trophy sets if Xbox game
    from app.models.trophy_set import TrophySet
    from sqlalchemy import func as sqlfunc
    ts_result = await db.execute(
        select(sqlfunc.sum(TrophySet.gamerscore_total))
        .where(TrophySet.game_id == data.game_id)
    )
    gamerscore_total = ts_result.scalar() or None

    user_game = UserGame(
        user_id=user_id,
        game_id=data.game_id,
        status=GameStatus.not_started,
        gamerscore_total=gamerscore_total,
    )
    db.add(user_game)
    await db.flush()
    result = await db.execute(
        select(UserGame)
        .where(UserGame.id == user_game.id)
        .options(selectinload(UserGame.game).selectinload(Game.game_genres))
    )
    return result.scalar_one()


async def get_user_library(
    db: AsyncSession, user_id: uuid.UUID, status: str | None = None
) -> list[UserGame]:
    q = (
        select(UserGame)
        .where(UserGame.user_id == user_id)
        .options(selectinload(UserGame.game).selectinload(Game.game_genres))
        .order_by(UserGame.updated_at.desc())
    )
    if status:
        q = q.where(UserGame.status == status)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_user_game(
    db: AsyncSession, user_id: uuid.UUID, game_id: uuid.UUID
) -> UserGame:
    result = await db.execute(
        select(UserGame)
        .where(UserGame.user_id == user_id, UserGame.game_id == game_id)
        .options(selectinload(UserGame.game).selectinload(Game.game_genres))
    )
    ug = result.scalar_one_or_none()
    if not ug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found in your library",
        )
    return ug


async def update_user_game(
    db: AsyncSession,
    user_id: uuid.UUID,
    game_id: uuid.UUID,
    data: UserGameUpdate,
) -> UserGame:
    ug = await get_user_game(db, user_id, game_id)
    updates = data.model_dump(exclude_unset=True)

    # Auto-set started_at when status moves to in_progress
    if updates.get("status") == GameStatus.in_progress and not ug.started_at:
        ug.started_at = datetime.now(timezone.utc)

    # Auto-set completed_at when status moves to a completion state
    completion_states = {GameStatus.completed, GameStatus.platinum, GameStatus.full_completion}
    if updates.get("status") in completion_states and not ug.completed_at:
        ug.completed_at = datetime.now(timezone.utc)

    for field, value in updates.items():
        setattr(ug, field, value)

    await db.flush()
    await db.refresh(ug, ["game"])
    return ug


async def remove_game_from_library(
    db: AsyncSession, user_id: uuid.UUID, game_id: uuid.UUID
) -> None:
    ug = await get_user_game(db, user_id, game_id)
    await db.delete(ug)


async def recalculate_completion(
    db: AsyncSession, user_id: uuid.UUID, game_id: uuid.UUID
) -> int:
    """Recalculate completion_percent based on completed achievements.
    Called after any achievement is marked complete."""
    from app.models.achievement import Achievement, UserAchievement
    from sqlalchemy import func

    total = await db.scalar(
        select(func.count(Achievement.id)).where(Achievement.game_id == game_id)
    )
    if not total:
        return 0

    completed = await db.scalar(
        select(func.count(UserAchievement.id)).where(
            UserAchievement.user_id == user_id,
            UserAchievement.is_completed == True,
            UserAchievement.achievement_id.in_(
                select(Achievement.id).where(Achievement.game_id == game_id)
            ),
        )
    )
    percent = round((completed / total) * 100)

    # Update the user_game record
    result = await db.execute(
        select(UserGame).where(
            UserGame.user_id == user_id, UserGame.game_id == game_id
        )
    )
    ug = result.scalar_one_or_none()
    if ug:
        ug.completion_percent = percent

        # Auto-promote status based on completion
        if percent == 100:
            # Check if the game has a platinum trophy and the user earned it
            from app.models.achievement import Achievement, TrophyType
            platinum_achievement = await db.scalar(
                select(Achievement).where(
                    Achievement.game_id == game_id,
                    Achievement.trophy_type == TrophyType.platinum,
                )
            )
            if platinum_achievement:
                # Check if user earned it
                from app.models.achievement import UserAchievement
                earned_platinum = await db.scalar(
                    select(UserAchievement).where(
                        UserAchievement.user_id == user_id,
                        UserAchievement.achievement_id == platinum_achievement.id,
                        UserAchievement.is_completed == True,
                    )
                )
                if earned_platinum:
                    ug.status = GameStatus.platinum
                else:
                    ug.status = GameStatus.full_completion
            else:
                ug.status = GameStatus.full_completion
        elif percent > 0 and ug.status == GameStatus.not_started:
            ug.status = GameStatus.in_progress
            if not ug.started_at:
                from datetime import datetime, timezone
                ug.started_at = datetime.now(timezone.utc)

        await db.flush()

    return percent
