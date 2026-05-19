import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.achievement import Achievement, UserAchievement
from app.models.progress import UserGame
from app.models.game import Game
from app.services.psn_service import fetch_earned_trophies
from app.services.game_service import recalculate_completion
from app.services.xbox_service import fetch_user_xbox_achievements


async def sync_steam_game(
    db: AsyncSession,
    user_id: uuid.UUID,
    game_id: uuid.UUID,
) -> dict:
    """Sync a user's earned Steam achievements for a specific game.

    - Fetches earned achievements from Steam using the game's appid
    - Marks matching UserAchievement records as completed
    - Creates UserAchievement records for newly earned achievements if missing
    - Recalculates completion_percent on UserGame

    Returns a summary dict with counts.
    """
    import httpx
    from app.config import get_settings
    settings = get_settings()

    # Load the game
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    if game.platform != "steam":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Steam sync is only available for Steam games",
        )

    if not game.platform_game_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This game has no Steam app ID — cannot sync",
        )

    # Load the user to get their Steam ID
    from app.models.user import User
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    steam_id = user.steam_id if user else None

    if not steam_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Steam ID stored for your account. Please add your Steam ID in your profile.",
        )

    if not settings.steam_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Steam API key not configured on this server.",
        )

    # Fetch earned achievements from Steam
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/",
                params={
                    "key": settings.steam_api_key,
                    "steamid": steam_id,
                    "appid": game.platform_game_id,
                    "l": "english",
                },
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as e:
        steam_status = e.response.status_code
        print(f"[steam_sync] Steam API returned {steam_status}: {e.response.text[:500]}")
        if steam_status == 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Steam returned an error — the game may have no achievements or your profile may be private.",
            )
        if steam_status == 401:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Steam API key is invalid or expired.",
            )
        if steam_status == 403:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Steam profile is private — set your game details to public at steamcommunity.com/my/edit/settings.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Steam API error: {steam_status} — {e.response.text[:200]}",
        )
    except Exception as e:
        print(f"[steam_sync] Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to reach Steam API: {str(e)}",
        )

    player_stats = data.get("playerstats", {})
    if not player_stats.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Steam could not return achievements — the game may have no achievements or your Steam profile is set to private.",
        )

    raw_achievements = player_stats.get("achievements", [])

    # Build earned_map: apiname -> unlock timestamp (for earned ones only)
    earned_map: dict[str, datetime | None] = {}
    for a in raw_achievements:
        if a.get("achieved") == 1:
            unlock_time = a.get("unlocktime")
            earned_dt = (
                datetime.fromtimestamp(unlock_time, tz=timezone.utc)
                if unlock_time and unlock_time > 0
                else datetime.now(timezone.utc)
            )
            earned_map[a["apiname"]] = earned_dt

    if not earned_map:
        return {
            "synced": 0,
            "created": 0,
            "already_completed": 0,
            "total_earned_on_steam": 0,
            "completion_percent": None,
        }

    # Load all achievements for this game
    ach_result = await db.execute(
        select(Achievement).where(Achievement.game_id == game_id)
    )
    achievements = ach_result.scalars().all()

    # Build lookup: platform_achievement_id (= apiname) -> Achievement
    ach_map = {
        a.platform_achievement_id: a
        for a in achievements
        if a.platform_achievement_id
    }

    # Load existing UserAchievements for this user + game
    ua_result = await db.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id.in_([a.id for a in achievements]),
        )
    )
    existing_uas = {ua.achievement_id: ua for ua in ua_result.scalars().all()}

    synced = 0
    created = 0
    already_completed = 0

    for apiname, earned_dt in earned_map.items():
        achievement = ach_map.get(apiname)
        if not achievement:
            # Achievement exists on Steam but not in our catalogue — skip
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

    return {
        "synced": synced,
        "created": created,
        "already_completed": already_completed,
        "total_earned_on_steam": len(earned_map),
        "completion_percent": percent,
    }


async def sync_xbox_game(
    db: AsyncSession,
    user_id: uuid.UUID,
    game_id: uuid.UUID,
) -> dict:
    """Sync a user's earned Xbox achievements for a specific game.

    - Fetches earned achievements from Xbox Live using the game's title_id
    - Marks matching UserAchievement records as completed
    - Creates UserAchievement records for newly earned achievements if missing
    - Recalculates completion_percent on UserGame

    Returns a summary dict with counts.
    """
    # Load the game
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    if game.platform != "xbox":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Xbox sync is only available for Xbox games",
        )

    if not game.platform_game_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This game has no Xbox title ID — cannot sync",
        )

    # Fetch earned achievements from Xbox Live
    try:
        earned_list = await fetch_user_xbox_achievements(db, user_id, game.platform_game_id)
    except Exception as e:
        msg = str(e)
        if "No Xbox account connected" in msg or "Xbox session expired" in msg:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Xbox Live API error: {msg}",
        )

    if not earned_list:
        return {
            "synced": 0,
            "created": 0,
            "already_completed": 0,
            "total_earned_on_xbox": 0,
            "completion_percent": None,
        }

    # Build earned_map: platform_achievement_id -> unlock datetime
    earned_map: dict[str, datetime] = {}
    for e in earned_list:
        try:
            unlock_dt = datetime.fromisoformat(str(e["time_unlocked"]).replace("Z", "+00:00"))
        except Exception:
            unlock_dt = datetime.now(timezone.utc)
        earned_map[e["platform_achievement_id"]] = unlock_dt

    # Load all achievements for this game
    ach_result = await db.execute(
        select(Achievement).where(Achievement.game_id == game_id)
    )
    achievements = ach_result.scalars().all()

    ach_map = {
        a.platform_achievement_id: a
        for a in achievements
        if a.platform_achievement_id
    }

    # Load existing UserAchievements
    ua_result = await db.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id.in_([a.id for a in achievements]),
        )
    )
    existing_uas = {ua.achievement_id: ua for ua in ua_result.scalars().all()}

    synced = 0
    created = 0
    already_completed = 0

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

    return {
        "synced": synced,
        "created": created,
        "already_completed": already_completed,
        "total_earned_on_xbox": len(earned_map),
        "completion_percent": percent,
    }


async def sync_psn_game(
    db: AsyncSession,
    user_id: uuid.UUID,
    game_id: uuid.UUID,
) -> dict:
    """Sync a user's earned PSN trophies for a specific game.

    - Fetches earned trophies from PSN using the game's np_communication_id
    - Marks matching UserAchievement records as completed
    - Creates UserAchievement records for newly earned trophies if missing
    - Recalculates completion_percent on UserGame

    Returns a summary dict with counts.
    """

    # Load the game
    result = await db.execute(
        select(Game)
        .where(Game.id == game_id)
        .options(selectinload(Game.game_genres))
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    if game.platform != "psn":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PSN sync is only available for PSN games",
        )

    if not game.platform_game_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This game has no PSN communication ID — cannot sync",
        )

    # Load the user to get their NPSSO
    from app.models.user import User
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    user_npsso = user.psn_npsso if user else None

    if not user_npsso:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No PSN token stored for your account. Please disconnect and reconnect your PSN account in your profile.",
        )

    # Try PS5 first, fall back to PS4 if the trophy service returns nothing
    earned_trophies = []
    for platform in ("PS5", "PS4"):
        try:
            print(f"[sync] Trying {platform} for {game.platform_game_id}...")
            earned_trophies = await fetch_earned_trophies(
                np_communication_id=game.platform_game_id,
                platform=platform,
                db=db,
                user_npsso=user_npsso,
            )
            print(f"[sync] {platform} returned {len(earned_trophies)} trophies")
            if earned_trophies:
                earned_count = sum(1 for t in earned_trophies if t["earned"])
                print(f"[sync] {earned_count} of {len(earned_trophies)} are earned")
                break
        except Exception as e:
            print(f"[sync] {platform} failed: {e}")
            continue

    # Build lookup: platform_achievement_id -> earned data
    earned_map = {
        t["platform_achievement_id"]: t
        for t in earned_trophies
        if t["earned"]
    }

    print(f"[sync] earned_map has {len(earned_map)} entries: {list(earned_map.keys())[:5]}...")

    if not earned_map:
        return {"synced": 0, "created": 0, "already_completed": 0, "total_earned_on_psn": 0}

    # Load all achievements for this game
    ach_result = await db.execute(
        select(Achievement).where(Achievement.game_id == game_id)
    )
    achievements = ach_result.scalars().all()

    # Build lookup: platform_achievement_id -> Achievement
    ach_map = {
        a.platform_achievement_id: a
        for a in achievements
        if a.platform_achievement_id
    }
    print(f"[sync] ach_map has {len(ach_map)} achievements with platform IDs (out of {len(achievements)} total)")

    # Load existing UserAchievements for this user + game
    ua_result = await db.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id.in_([a.id for a in achievements]),
        )
    )
    existing_uas = {ua.achievement_id: ua for ua in ua_result.scalars().all()}

    synced = 0
    created = 0
    already_completed = 0

    for platform_id, earned_data in earned_map.items():
        achievement = ach_map.get(platform_id)
        if not achievement:
            # Trophy exists on PSN but not in our catalogue — skip
            continue

        ua = existing_uas.get(achievement.id)

        if ua:
            if ua.is_completed:
                already_completed += 1
                continue
            # Mark as completed
            ua.is_completed = True
            ua.completed_at = earned_data["earned_date_time"] or datetime.now(timezone.utc)
            synced += 1
        else:
            # Create a new UserAchievement marked completed
            ua = UserAchievement(
                user_id=user_id,
                achievement_id=achievement.id,
                is_completed=True,
                completed_at=earned_data["earned_date_time"] or datetime.now(timezone.utc),
            )
            db.add(ua)
            created += 1

    await db.flush()

    # Recalculate completion_percent
    percent = await recalculate_completion(db, user_id, game_id)

    return {
        "synced": synced,
        "created": created,
        "already_completed": already_completed,
        "total_earned_on_psn": len(earned_map),
        "completion_percent": percent,
    }
