"""Public (unauthenticated) endpoints — used by the landing page."""
import random
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models.game import Game
from app.models.achievement import Achievement, UserAchievement
from app.schemas.game import GameResponse
from app.schemas.achievement import AchievementSummary

router = APIRouter()


@router.get("/featured-game")
async def get_featured_game(db: AsyncSession = Depends(get_db)):
    """Return the most recently active game + its first 8 achievements.

    'Most recently active' = game with the most recent user_achievement
    completed_at timestamp in the last 7 days, across all users.
    Falls back to a random game from the catalogue if there's no recent
    activity (e.g. fresh DB or quiet period).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    # Find game_id with the most recent completed achievement in the last 7 days
    recent = await db.execute(
        select(Achievement.game_id, func.max(UserAchievement.completed_at).label("last_activity"))
        .join(UserAchievement, UserAchievement.achievement_id == Achievement.id)
        .where(
            UserAchievement.is_completed == True,
            UserAchievement.completed_at >= cutoff,
        )
        .group_by(Achievement.game_id)
        .order_by(func.max(UserAchievement.completed_at).desc())
        .limit(1)
    )
    row = recent.first()

    if row:
        game_id = row.game_id
    else:
        # Fallback: pick a random game that has a cover image
        candidates = await db.execute(
            select(Game.id).where(Game.cover_image_url.isnot(None))
        )
        ids = [r[0] for r in candidates.all()]
        if not ids:
            return None
        game_id = random.choice(ids)

    # Load game
    game_result = await db.execute(
        select(Game)
        .where(Game.id == game_id)
        .options(selectinload(Game.game_genres))
    )
    game = game_result.scalar_one_or_none()
    if not game:
        return None

    # Load first 8 achievements for this game (by sort_order)
    ach_result = await db.execute(
        select(Achievement)
        .where(Achievement.game_id == game_id)
        .order_by(Achievement.sort_order)
        .limit(8)
    )
    achievements = ach_result.scalars().all()

    return {
        "game": GameResponse.model_validate(game),
        "achievements": [
            AchievementSummary(
                id=a.id,
                title=a.title,
                description=a.description,
                trophy_type=a.trophy_type,
                gamerscore=a.gamerscore,
                rarity=a.rarity,
                is_completed=False,
                is_pinned=False,
                icon_url=a.icon_url,
                trophy_set_id=a.trophy_set_id,
            )
            for a in achievements
        ],
    }
