"""
Seed service — import well-known games into the catalogue without requiring
the admin to personally own them. Uses Steam's public achievement schema API.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.game import Game
from app.models.trophy_set import TrophySet
from app.models.achievement import Achievement
from app.services.steam_service import fetch_steam_achievements, get_game_details


# ── Catalogue of seed-able games ──────────────────────────────────────────────
# Each entry: { slug, title, app_id, cover_url (optional override) }
# cover_url is fetched from Steam store if not provided.
SEED_CATALOGUE = [
    {
        "slug": "steam-elden-ring",
        "title": "Elden Ring",
        "app_id": "1245620",
        "platform": "manual",
    },
    {
        "slug": "steam-hades",
        "title": "Hades",
        "app_id": "1145360",
        "platform": "manual",
    },
    {
        "slug": "steam-hollow-knight",
        "title": "Hollow Knight",
        "app_id": "367520",
        "platform": "manual",
    },
    {
        "slug": "steam-celeste",
        "title": "Celeste",
        "app_id": "504230",
        "platform": "manual",
    },
    {
        "slug": "steam-cyberpunk-2077",
        "title": "Cyberpunk 2077",
        "app_id": "1091500",
        "platform": "manual",
    },
    {
        "slug": "steam-baldurs-gate-3",
        "title": "Baldur's Gate 3",
        "app_id": "1086940",
        "platform": "manual",
    },
    {
        "slug": "steam-dark-souls-3",
        "title": "Dark Souls III",
        "app_id": "374320",
        "platform": "manual",
    },
    {
        "slug": "steam-sekiro",
        "title": "Sekiro: Shadows Die Twice",
        "app_id": "814380",
        "platform": "manual",
    },
    {
        "slug": "steam-witcher-3",
        "title": "The Witcher 3: Wild Hunt",
        "app_id": "292030",
        "platform": "manual",
    },
    {
        "slug": "steam-stardew-valley",
        "title": "Stardew Valley",
        "app_id": "413150",
        "platform": "manual",
    },
    {
        "slug": "steam-disco-elysium",
        "title": "Disco Elysium",
        "app_id": "632470",
        "platform": "manual",
    },
    {
        "slug": "steam-dead-cells",
        "title": "Dead Cells",
        "app_id": "588650",
        "platform": "manual",
    },
]

# slug → entry dict for quick lookup
SEED_CATALOGUE_BY_SLUG = {g["slug"]: g for g in SEED_CATALOGUE}


async def seed_game(db: AsyncSession, slug: str) -> dict:
    """
    Seed a game by slug. Skip silently if already in the catalogue
    (detected via platform_communication_id match on TrophySet).

    Returns a result dict with status + counts.
    """
    entry = SEED_CATALOGUE_BY_SLUG.get(slug)
    if not entry:
        raise ValueError(f"Unknown seed slug: {slug!r}")

    app_id = entry["app_id"]

    # Duplicate check — if this app_id is already imported, skip
    existing = await db.execute(
        select(TrophySet).where(TrophySet.platform_communication_id == app_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return {
            "status": "skipped",
            "reason": "already_imported",
            "title": entry["title"],
        }

    # Fetch achievement schema from Steam (public — no user auth needed)
    steam_data = await fetch_steam_achievements("", app_id)

    if steam_data["total"] == 0:
        return {
            "status": "skipped",
            "reason": "no_achievements",
            "title": entry["title"],
        }

    # Get cover art from Steam store
    cover_url = entry.get("cover_url")
    if not cover_url:
        details = await get_game_details(app_id)
        cover_url = details.get("cover_url")

    # Create Game row — platform=None means platform-neutral (no sync restriction)
    game = Game(
        title=entry["title"],
        platform=None,
        platform_game_id=None,
        cover_image_url=cover_url,
    )
    db.add(game)
    await db.flush()

    # Create TrophySet — platform=None means "universal / manual tracking only"
    # The steam app_id is stored so a future Steam import can find and attach to this game
    trophy_set = TrophySet(
        game_id=game.id,
        name="Base Game",
        platform_communication_id=app_id,
        platform=None,
        sort_order=0,
    )
    db.add(trophy_set)
    await db.flush()

    # Create Achievements
    for ach in steam_data["achievements"]:
        achievement = Achievement(
            game_id=game.id,
            trophy_set_id=trophy_set.id,
            title=ach["title"],
            description=ach.get("description") or "",
            platform_achievement_id=ach["platform_achievement_id"],
            icon_url=ach.get("icon_url"),
            rarity=ach.get("rarity"),
            sort_order=ach.get("sort_order", 0),
        )
        db.add(achievement)

    await db.flush()

    return {
        "status": "imported",
        "title": entry["title"],
        "game_id": str(game.id),
        "achievements_imported": steam_data["total"],
        "cover_url": cover_url,
    }
