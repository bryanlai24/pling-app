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
