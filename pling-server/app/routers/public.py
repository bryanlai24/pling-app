"""Public (unauthenticated) endpoints — used by the landing page and public profiles."""
import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models.game import Game
from app.models.achievement import Achievement, UserAchievement
from app.models.progress import UserGame
from app.models.user import User
from app.schemas.game import GameResponse
from app.schemas.achievement import AchievementSummary
from app.schemas.user import (
    PublicProfileResponse, TrophyRoomGame, RecentGamePublic, UserStats,
    PsnStats, XboxStats, SteamStats,
)
from app.models.achievement import TrophyType
from app.models.progress import GameStatus
from app.models.game import Platform

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


@router.get("/users/{username}", response_model=PublicProfileResponse)
async def get_public_profile(username: str, db: AsyncSession = Depends(get_db)):
    """Public profile for a given username — no auth required."""

    # Load user
    user_result = await db.execute(select(User).where(User.username == username.lower()))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user_id = user.id

    # ── Stats (reuse same logic as /me/stats) ──────────────────────────────────
    games_tracked_r = await db.execute(
        select(func.count()).where(UserGame.user_id == user_id)
    )
    games_tracked = games_tracked_r.scalar() or 0

    completed_r = await db.execute(
        select(func.count())
        .where(UserGame.user_id == user_id)
        .where(UserGame.status.in_([GameStatus.platinum, GameStatus.full_completion]))
    )
    games_fully_completed = completed_r.scalar() or 0

    # PSN stats
    psn_games_r = await db.execute(
        select(func.count()).select_from(UserGame)
        .join(Game, Game.id == UserGame.game_id)
        .where(UserGame.user_id == user_id)
        .where(Game.platform == Platform.psn)
    )
    psn_count = psn_games_r.scalar() or 0
    psn_stats = None
    if psn_count > 0:
        trophies_r = await db.execute(
            select(func.count()).select_from(UserAchievement)
            .join(Achievement, Achievement.id == UserAchievement.achievement_id)
            .join(Game, Game.id == Achievement.game_id)
            .where(UserAchievement.user_id == user_id)
            .where(UserAchievement.is_completed == True)
            .where(Game.platform == Platform.psn)
        )
        platinums_r = await db.execute(
            select(func.count()).select_from(UserAchievement)
            .join(Achievement, Achievement.id == UserAchievement.achievement_id)
            .join(Game, Game.id == Achievement.game_id)
            .where(UserAchievement.user_id == user_id)
            .where(UserAchievement.is_completed == True)
            .where(Game.platform == Platform.psn)
            .where(Achievement.trophy_type == TrophyType.platinum)
        )
        psn_stats = PsnStats(
            trophies_earned=trophies_r.scalar() or 0,
            platinums=platinums_r.scalar() or 0,
        )

    # Xbox stats
    xbox_r = await db.execute(
        select(
            func.coalesce(func.sum(UserGame.gamerscore_earned), 0),
            func.coalesce(func.sum(UserGame.gamerscore_total), 0),
        )
        .select_from(UserGame)
        .join(Game, Game.id == UserGame.game_id)
        .where(UserGame.user_id == user_id)
        .where(Game.platform == Platform.xbox)
    )
    xbox_row = xbox_r.one_or_none()
    xbox_stats = None
    if xbox_row and (xbox_row[0] or xbox_row[1]):
        xbox_stats = XboxStats(gamerscore_earned=xbox_row[0] or 0, gamerscore_total=xbox_row[1] or 0)

    # Steam stats
    steam_r = await db.execute(
        select(func.count()).select_from(UserGame)
        .join(Game, Game.id == UserGame.game_id)
        .where(UserGame.user_id == user_id)
        .where(Game.platform == Platform.steam)
        .where(UserGame.status == GameStatus.full_completion)
    )
    steam_completed = steam_r.scalar() or 0
    steam_stats = SteamStats(games_completed=steam_completed) if steam_completed > 0 else None

    stats = UserStats(
        games_tracked=games_tracked,
        games_fully_completed=games_fully_completed,
        psn=psn_stats,
        xbox=xbox_stats,
        steam=steam_stats,
    )

    # ── Legacy score ───────────────────────────────────────────────────────────
    # PSN: count completed trophies by type and apply weights
    PSN_WEIGHTS = {
        TrophyType.bronze: 15,
        TrophyType.silver: 30,
        TrophyType.gold: 90,
        TrophyType.platinum: 300,
    }
    legacy_score = 0

    psn_by_type_r = await db.execute(
        select(Achievement.trophy_type, func.count())
        .select_from(UserAchievement)
        .join(Achievement, Achievement.id == UserAchievement.achievement_id)
        .join(Game, Game.id == Achievement.game_id)
        .where(UserAchievement.user_id == user_id)
        .where(UserAchievement.is_completed == True)
        .where(Game.platform == Platform.psn)
        .where(Achievement.trophy_type.isnot(None))
        .group_by(Achievement.trophy_type)
    )
    for trophy_type, count in psn_by_type_r.all():
        legacy_score += PSN_WEIGHTS.get(trophy_type, 0) * count

    # Xbox: gamerscore earned 1:1
    if xbox_stats:
        legacy_score += xbox_stats.gamerscore_earned

    # Steam: 500pts per 100% completed game
    legacy_score += steam_completed * 500

    # ── Trophy Room — all games the user has fully completed ──────────────────
    trophy_r = await db.execute(
        select(UserGame)
        .where(UserGame.user_id == user_id)
        .where(UserGame.status.in_([GameStatus.platinum, GameStatus.full_completion]))
        .options(selectinload(UserGame.game))
        .order_by(UserGame.completed_at.desc().nullslast(), UserGame.updated_at.desc())
    )
    trophy_ugs = trophy_r.scalars().all()

    trophy_room = [
        TrophyRoomGame(
            id=ug.game.id,
            title=ug.game.title,
            cover_image_url=ug.game.cover_image_url,
            platform=ug.game.platform.value,
            gamerscore_total=ug.gamerscore_total,
        )
        for ug in trophy_ugs
    ]

    # ── Recently played (last 5 games by UserGame.updated_at) ─────────────────
    recent_r = await db.execute(
        select(UserGame)
        .where(UserGame.user_id == user_id)
        .options(selectinload(UserGame.game))
        .order_by(UserGame.updated_at.desc())
        .limit(5)
    )
    recent_ugs = recent_r.scalars().all()

    recently_played = [
        RecentGamePublic(
            id=ug.game.id,
            title=ug.game.title,
            cover_image_url=ug.game.cover_image_url,
            platform=ug.game.platform.value,
            completion_percent=ug.completion_percent,
            gamerscore_earned=ug.gamerscore_earned,
            gamerscore_total=ug.gamerscore_total,
            updated_at=ug.updated_at,
        )
        for ug in recent_ugs
    ]

    return PublicProfileResponse(
        username=user.username,
        psn_id=user.psn_id,
        xbox_gamertag=user.xbox_gamertag,
        steam_display_name=user.steam_display_name,
        steam_id=user.steam_id,
        member_since=user.created_at,
        legacy_score=legacy_score,
        stats=stats,
        trophy_room=trophy_room,
        recently_played=recently_played,
    )
