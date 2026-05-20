import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.achievement import Achievement, AchievementPlatformId, UserAchievement
from app.models.trophy_set import TrophySet
from app.models.progress import UserGame
from app.models.game import Game
from app.services.psn_service import fetch_earned_trophies
from app.services.game_service import recalculate_completion
from app.services.xbox_service import fetch_user_xbox_achievements


async def _get_trophy_set_for_platform(
    db: AsyncSession, game_id: uuid.UUID, platform: str
) -> TrophySet | None:
    """Return the TrophySet for a game+platform, or None if not imported yet."""
    result = await db.execute(
        select(TrophySet).where(
            TrophySet.game_id == game_id,
            TrophySet.platform == platform,
        ).limit(1)
    )
    return result.scalar_one_or_none()


async def _get_platform_ach_map(
    db: AsyncSession, trophy_set_id: uuid.UUID, platform: str
) -> dict[str, Achievement]:
    """Return {platform_achievement_id: Achievement} for a given trophy set + platform.

    Uses AchievementPlatformId rows when available (multi-platform games),
    falling back to Achievement.platform_achievement_id for legacy single-
    platform imports.
    """
    # Load all achievements in this trophy set
    ach_result = await db.execute(
        select(Achievement).where(Achievement.trophy_set_id == trophy_set_id)
    )
    achievements = ach_result.scalars().all()

    # Try AchievementPlatformId first
    if achievements:
        pid_result = await db.execute(
            select(AchievementPlatformId).where(
                AchievementPlatformId.platform == platform,
                AchievementPlatformId.achievement_id.in_([a.id for a in achievements]),
            )
        )
        pid_rows = pid_result.scalars().all()
        if pid_rows:
            ach_by_id = {a.id: a for a in achievements}
            return {
                row.platform_achievement_id: ach_by_id[row.achievement_id]
                for row in pid_rows
                if row.achievement_id in ach_by_id
            }

    # Fallback: use bare platform_achievement_id on Achievement (legacy imports)
    return {
        a.platform_achievement_id: a
        for a in achievements
        if a.platform_achievement_id
    }


async def _apply_earned(
    db: AsyncSession,
    user_id: uuid.UUID,
    game_id: uuid.UUID,
    earned_map: dict[str, datetime],  # platform_achievement_id -> earned_at
    ach_map: dict[str, Achievement],  # platform_achievement_id -> Achievement
) -> dict:
    """Apply earned achievements to UserAchievement rows, return counts."""
    # Load existing UserAchievements for this user + all achievements in ach_map
    ach_ids = [a.id for a in ach_map.values()]
    ua_result = await db.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id.in_(ach_ids),
        )
    )
    existing_uas = {ua.achievement_id: ua for ua in ua_result.scalars().all()}

    synced = created = already_completed = 0

    for platform_id, earned_dt in earned_map.items():
        achievement = ach_map.get(platform_id)
        if not achievement:
            continue

        ua = existing_uas.get(achievement.id)
        if ua:
            if ua.is_completed:
                already_completed += 1
                continue
            ua.is_completed = True
            ua.completed_at = earned_dt
            synced += 1
        else:
            db.add(UserAchievement(
                user_id=user_id,
                achievement_id=achievement.id,
                is_completed=True,
                completed_at=earned_dt,
            ))
            created += 1

    await db.flush()
    percent = await recalculate_completion(db, user_id, game_id)
    return {"synced": synced, "created": created, "already_completed": already_completed, "completion_percent": percent}


async def sync_steam_game(
    db: AsyncSession,
    user_id: uuid.UUID,
    game_id: uuid.UUID,
) -> dict:
    """Sync a user's earned Steam achievements for a specific game."""
    import httpx
    from app.config import get_settings
    settings = get_settings()

    # Load the game
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    # Find Steam trophy set — prefer explicit platform=steam, fall back to game.platform
    trophy_set = await _get_trophy_set_for_platform(db, game_id, "steam")
    if not trophy_set:
        # Legacy: single-platform game
        if game.platform != "steam":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This game has no Steam trophy set — import the Steam version first.",
            )
        # Use whichever trophy set exists
        ts_result = await db.execute(
            select(TrophySet).where(TrophySet.game_id == game_id).limit(1)
        )
        trophy_set = ts_result.scalar_one_or_none()

    if not trophy_set or not trophy_set.platform_communication_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This game has no Steam app ID — cannot sync",
        )

    app_id = trophy_set.platform_communication_id

    # Load user Steam ID
    from app.models.user import User
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.steam_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Steam ID stored for your account. Please add your Steam ID in your profile.",
        )

    if not settings.steam_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Steam API key not configured.")

    # Fetch earned achievements from Steam
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/",
                params={"key": settings.steam_api_key, "steamid": user.steam_id, "appid": app_id, "l": "english"},
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as e:
        steam_status = e.response.status_code
        if steam_status == 403:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                detail="Steam profile is private — set your game details to public at steamcommunity.com/my/edit/settings.")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Steam API error: {steam_status} — {e.response.text[:200]}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to reach Steam API: {str(e)}")

    player_stats = data.get("playerstats", {})
    if not player_stats.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
            detail="Steam could not return achievements — the game may have no achievements or your profile is private.")

    earned_map: dict[str, datetime] = {}
    for a in player_stats.get("achievements", []):
        if a.get("achieved") == 1:
            unlock_time = a.get("unlocktime")
            earned_map[a["apiname"]] = (
                datetime.fromtimestamp(unlock_time, tz=timezone.utc)
                if unlock_time and unlock_time > 0
                else datetime.now(timezone.utc)
            )

    if not earned_map:
        return {"synced": 0, "created": 0, "already_completed": 0, "total_earned_on_steam": 0, "completion_percent": None}

    ach_map = await _get_platform_ach_map(db, trophy_set.id, "steam")
    result = await _apply_earned(db, user_id, game_id, earned_map, ach_map)
    return {**result, "total_earned_on_steam": len(earned_map)}


async def sync_xbox_game(
    db: AsyncSession,
    user_id: uuid.UUID,
    game_id: uuid.UUID,
) -> dict:
    """Sync a user's earned Xbox achievements for a specific game."""
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    # Find Xbox trophy set
    trophy_set = await _get_trophy_set_for_platform(db, game_id, "xbox")
    if not trophy_set:
        if game.platform != "xbox":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This game has no Xbox trophy set — import the Xbox version first.",
            )
        ts_result = await db.execute(
            select(TrophySet).where(TrophySet.game_id == game_id).limit(1)
        )
        trophy_set = ts_result.scalar_one_or_none()

    if not trophy_set or not trophy_set.platform_communication_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
            detail="This game has no Xbox title ID — cannot sync")

    try:
        earned_list = await fetch_user_xbox_achievements(db, user_id, trophy_set.platform_communication_id)
    except Exception as e:
        msg = str(e)
        if "No Xbox account connected" in msg or "Xbox session expired" in msg:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Xbox Live API error: {msg}")

    if not earned_list:
        return {"synced": 0, "created": 0, "already_completed": 0, "total_earned_on_xbox": 0, "completion_percent": None}

    earned_map: dict[str, datetime] = {}
    for e in earned_list:
        try:
            unlock_dt = datetime.fromisoformat(str(e["time_unlocked"]).replace("Z", "+00:00"))
        except Exception:
            unlock_dt = datetime.now(timezone.utc)
        earned_map[e["platform_achievement_id"]] = unlock_dt

    ach_map = await _get_platform_ach_map(db, trophy_set.id, "xbox")
    result = await _apply_earned(db, user_id, game_id, earned_map, ach_map)
    return {**result, "total_earned_on_xbox": len(earned_map)}


async def sync_psn_game(
    db: AsyncSession,
    user_id: uuid.UUID,
    game_id: uuid.UUID,
) -> dict:
    """Sync a user's earned PSN trophies for a specific game."""
    result = await db.execute(
        select(Game).where(Game.id == game_id).options(selectinload(Game.game_genres))
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    # Find PSN trophy set
    trophy_set = await _get_trophy_set_for_platform(db, game_id, "psn")
    if not trophy_set:
        if game.platform != "psn":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This game has no PSN trophy set — import the PSN version first.",
            )
        ts_result = await db.execute(
            select(TrophySet).where(TrophySet.game_id == game_id).limit(1)
        )
        trophy_set = ts_result.scalar_one_or_none()

    if not trophy_set or not trophy_set.platform_communication_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
            detail="This game has no PSN communication ID — cannot sync")

    from app.models.user import User
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.psn_npsso:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
            detail="No PSN token stored for your account. Please reconnect your PSN account in your profile.")

    earned_trophies = []
    for platform in ("PS5", "PS4"):
        try:
            earned_trophies = await fetch_earned_trophies(
                np_communication_id=trophy_set.platform_communication_id,
                platform=platform,
                db=db,
                user_npsso=user.psn_npsso,
            )
            if earned_trophies:
                break
        except Exception:
            continue

    earned_map = {
        t["platform_achievement_id"]: t
        for t in earned_trophies
        if t["earned"]
    }

    if not earned_map:
        return {"synced": 0, "created": 0, "already_completed": 0, "total_earned_on_psn": 0}

    ach_map = await _get_platform_ach_map(db, trophy_set.id, "psn")

    # PSN earned_map values are dicts with earned_date_time, convert to datetime
    dt_earned_map = {
        pid: (data["earned_date_time"] or datetime.now(timezone.utc))
        for pid, data in earned_map.items()
    }

    result = await _apply_earned(db, user_id, game_id, dt_earned_map, ach_map)
    return {**result, "total_earned_on_psn": len(earned_map)}
