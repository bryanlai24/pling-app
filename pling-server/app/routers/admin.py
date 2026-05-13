import uuid, asyncio, re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timezone

from app.database import get_db
from app.auth.dependencies import get_current_user, require_admin
from app.models.user import User, UserRole
from app.models.game import Game
from app.models.trophy_set import TrophySet
from app.models.achievement import Achievement
from app.models.xbox_token import XboxToken
from app.services.psn_service import fetch_trophies, get_psnawp
from app.schemas.user import UserPublic
from app.config import get_settings
from app.services.xbox_service import (
    generate_auth_url,
    exchange_code_for_tokens,
    search_xbox_titles,
    fetch_xbox_achievements,
)
from app.services.steam_service import search_owned_games, fetch_steam_achievements, get_game_details

settings = get_settings()
router = APIRouter()


class PSNImportRequest(BaseModel):
    np_communication_id: str
    game_title: str
    platform: str = "PS5"
    genre: str | None = None
    cover_image_url: str | None = None
    trophy_set_name: str = "Base Game"
    existing_game_id: uuid.UUID | None = None

class RoleUpdate(BaseModel):
    role: UserRole

@router.post("/import/psn", status_code=status.HTTP_201_CREATED)
async def import_psn_game(
    data: PSNImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    # Use the admin's connected PSN account
    if not current_user.psn_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must connect your PSN account before importing games. Go to your profile to connect.",
        )

    # Check if already imported
    existing_set = await db.execute(
        select(TrophySet).where(
            TrophySet.platform_communication_id == data.np_communication_id
        )
    )
    if existing_set.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This trophy set has already been imported",
        )

    # Fetch from PSN using the admin's account
    try:
        psn_data = await fetch_trophies(
            np_communication_id=data.np_communication_id,
            account_id=current_user.psn_account_id,
            platform=data.platform,
            db=db,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"PSN API error: {str(e)}",
        )

    # Get or create game
    if data.existing_game_id:
        result = await db.execute(
            select(Game).where(Game.id == data.existing_game_id)
        )
        game = result.scalar_one_or_none()
        if not game:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game not found",
            )
    else:
        game = Game(
            title=data.game_title,
            platform="psn",
            platform_game_id=data.np_communication_id,
            cover_image_url=data.cover_image_url or psn_data.get("cover_image_url"),
            genre=data.genre,
        )
        db.add(game)
        await db.flush()

    # Get sort order
    existing_sets = await db.execute(
        select(TrophySet).where(TrophySet.game_id == game.id)
    )
    set_count = len(existing_sets.scalars().all())

    # Create trophy set
    trophy_set = TrophySet(
        game_id=game.id,
        name=data.trophy_set_name,
        platform_communication_id=data.np_communication_id,
        sort_order=set_count,
    )
    db.add(trophy_set)
    await db.flush()

    # Create achievements
    for trophy in psn_data["trophies"]:
        achievement = Achievement(
            game_id=game.id,
            trophy_set_id=trophy_set.id,
            title=trophy["title"],
            description=trophy["description"],
            trophy_type=trophy["trophy_type"],
            platform_achievement_id=trophy["platform_achievement_id"],
            icon_url=trophy.get("icon_url"),
        )
        db.add(achievement)

    await db.flush()

    return {
        "message": f"Successfully imported {data.trophy_set_name} for {game.title}",
        "game_id": str(game.id),
        "trophy_set_id": str(trophy_set.id),
        "trophies_imported": len(psn_data["trophies"]),
    }

@router.patch("/users/{user_id}/role", response_model=UserPublic)
async def update_user_role(
    user_id: uuid.UUID,
    data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = data.role
    await db.flush()
    await db.refresh(user)
    return UserPublic.model_validate(user)

@router.get("/psn/search")
async def search_psn_library(
    query: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not current_user.psn_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must connect your PSN account first",
        )

    def _normalize(text: str) -> str:
        import re
        text = re.sub(r'[™®©℠]', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text.lower()

    def _search(q=query.lower()):
        psnawp = get_psnawp()
        user = psnawp.user(account_id=current_user.psn_account_id)
        normalized_query = _normalize(q)
        results = []
        for title in user.trophy_titles():
            if normalized_query in _normalize(title.title_name):
                results.append({
                    "title": title.title_name,
                    "np_communication_id": title.np_communication_id,
                    "platform": [p.value for p in title.title_platform],
                    "cover_image_url": title.title_icon_url,
                    "defined_trophies": {
                        "bronze": title.defined_trophies.bronze,
                        "silver": title.defined_trophies.silver,
                        "gold": title.defined_trophies.gold,
                        "platinum": title.defined_trophies.platinum,
                    },
                    "total_trophies": (
                        title.defined_trophies.bronze +
                        title.defined_trophies.silver +
                        title.defined_trophies.gold +
                        title.defined_trophies.platinum
                    ),
                })
        return results

    try:
        results = await asyncio.get_event_loop().run_in_executor(None, _search)
        return results
    except Exception as e:
        print(f"PSN search error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"PSN search failed: {str(e)}"
        )

@router.get("/psn/status")
async def psn_token_status(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Check PSN token health."""
    from app.models.psn_token import PSNToken
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(PSNToken).order_by(PSNToken.updated_at.desc()).limit(1)
    )
    token = result.scalar_one_or_none()

    if not token:
        return {"status": "no_tokens", "message": "No PSN tokens stored yet"}

    if token.refresh_token_expires_at < now:
        return {
            "status": "expired",
            "message": "Refresh token expired — new NPSSO required",
            "refresh_token_expires_at": token.refresh_token_expires_at.isoformat(),
        }

    if token.access_token_expires_at < now:
        return {
            "status": "needs_refresh",
            "message": "Access token expired but refresh token valid — will auto-refresh",
            "refresh_token_expires_at": token.refresh_token_expires_at.isoformat(),
        }

    return {
        "status": "healthy",
        "access_token_expires_at": token.access_token_expires_at.isoformat(),
        "refresh_token_expires_at": token.refresh_token_expires_at.isoformat(),
    }

# ── Xbox ───────────────────────────────────────────────────────────────────────

@router.get("/xbox/status")
async def xbox_token_status(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Check Xbox token health."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(XboxToken).order_by(XboxToken.updated_at.desc()).limit(1)
    )
    token = result.scalar_one_or_none()

    if not token:
        return {"status": "no_tokens", "message": "Not authenticated with Xbox"}

    if token.refresh_token_expires_at < now:
        return {"status": "expired", "message": "Re-authentication required"}

    if token.access_token_expires_at < now:
        return {
            "status": "needs_refresh",
            "message": "Will auto-refresh on next request",
            "gamertag": token.gamertag,
        }

    return {
        "status": "healthy",
        "gamertag": token.gamertag,
        "xuid": token.xuid,
        "access_token_expires_at": token.access_token_expires_at.isoformat(),
        "refresh_token_expires_at": token.refresh_token_expires_at.isoformat(),
    }


@router.get("/xbox/auth-url")
async def get_xbox_auth_url(
    _: User = Depends(require_admin),
):
    """Get the Microsoft OAuth2 URL for Xbox authentication."""
    url = generate_auth_url()
    return {"url": url}


class XboxAuthCallback(BaseModel):
    code: str


@router.post("/xbox/auth-callback")
async def xbox_auth_callback(
    data: XboxAuthCallback,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Exchange OAuth code for Xbox tokens."""
    try:
        result = await exchange_code_for_tokens(db, data.code)
        return {"status": "connected", **result}
    except Exception as e:
        import traceback
        print(f"Xbox auth error: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Xbox auth failed: {str(e)}"
        )


@router.get("/xbox/search")
async def search_xbox_library(
    query: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Search Xbox catalog for games."""
    try:
        results = await search_xbox_titles(db, query)
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Xbox search failed: {str(e)}"
        )


class XboxImportRequest(BaseModel):
    title_id: str
    game_title: str
    genre: str | None = None
    cover_image_url: str | None = None
    trophy_set_name: str = "Base Game"
    existing_game_id: uuid.UUID | None = None


@router.post("/import/xbox", status_code=status.HTTP_201_CREATED)
async def import_xbox_game(
    data: XboxImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Import an Xbox game's achievements into the catalogue."""
    # Get stored XUID
    result = await db.execute(
        select(XboxToken).order_by(XboxToken.updated_at.desc()).limit(1)
    )
    token = result.scalar_one_or_none()
    if not token or not token.xuid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Xbox account not connected — authenticate first",
        )

    # Check if already imported
    existing_set = await db.execute(
        select(TrophySet).where(
            TrophySet.platform_communication_id == data.title_id
        )
    )
    if existing_set.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This title has already been imported",
        )

    # Fetch achievements from Xbox
    try:
        xbox_data = await fetch_xbox_achievements(db, data.title_id, token.xuid)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Xbox API error: {str(e)}",
        )

    # Get or create game
    if data.existing_game_id:
        result = await db.execute(select(Game).where(Game.id == data.existing_game_id))
        game = result.scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    else:
        game = Game(
            title=data.game_title,
            platform="xbox",
            platform_game_id=data.title_id,
            cover_image_url=data.cover_image_url,
            genre=data.genre,
        )
        db.add(game)
        await db.flush()

    # Get sort order
    existing_sets = await db.execute(
        select(TrophySet).where(TrophySet.game_id == game.id)
    )
    set_count = len(existing_sets.scalars().all())

    # Create trophy set
    trophy_set = TrophySet(
        game_id=game.id,
        name=data.trophy_set_name,
        platform_communication_id=data.title_id,
        sort_order=set_count,
        gamerscore_total=xbox_data["gamerscore_total"],
    )
    db.add(trophy_set)
    await db.flush()

    # Create achievements
    gamerscore_total = xbox_data["gamerscore_total"]
    for ach in xbox_data["achievements"]:
        achievement = Achievement(
            game_id=game.id,
            trophy_set_id=trophy_set.id,
            title=ach["title"],
            description=ach["description"],
            gamerscore=ach["gamerscore"],
            icon_url=ach["icon_url"],
            platform_achievement_id=str(ach["platform_achievement_id"]),
        )
        db.add(achievement)

    await db.flush()

    return {
        "message": f"Successfully imported {data.trophy_set_name} for {game.title}",
        "game_id": str(game.id),
        "trophy_set_id": str(trophy_set.id),
        "achievements_imported": len(xbox_data["achievements"]),
        "gamerscore_total": gamerscore_total,
    }

# ── Steam ──────────────────────────────────────────────────────────────────────

@router.get("/steam/search")
async def search_steam_library(
    query: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Search Steam owned games by name."""
    if not current_user.steam_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Steam ID not set — add your Steam ID in your profile first",
        )
    try:
        results = await search_owned_games(current_user.steam_id, query)
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Steam search failed: {str(e)}",
        )


class SteamImportRequest(BaseModel):
    app_id: str
    game_title: str
    genre: str | None = None
    cover_image_url: str | None = None
    trophy_set_name: str = "Base Game"
    existing_game_id: uuid.UUID | None = None


@router.post("/import/steam", status_code=status.HTTP_201_CREATED)
async def import_steam_game(
    data: SteamImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Import a Steam game's achievements into the catalogue."""
    if not current_user.steam_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Steam ID not set — add your Steam ID in your profile first",
        )

    # Check if already imported
    existing_set = await db.execute(
        select(TrophySet).where(
            TrophySet.platform_communication_id == data.app_id
        )
    )
    if existing_set.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This game has already been imported",
        )

    # Fetch achievements from Steam
    try:
        steam_data = await fetch_steam_achievements(current_user.steam_id, data.app_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Steam API error: {str(e)}",
        )

    if steam_data["total"] == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This game has no achievements",
        )

    # Get cover art from Steam store if not provided
    cover_image_url = data.cover_image_url
    genre = data.genre
    if not cover_image_url or not genre:
        details = await get_game_details(data.app_id)
        cover_image_url = cover_image_url or details["cover_url"]
        genre = genre or details["genre"]

    # Get or create game
    if data.existing_game_id:
        result = await db.execute(select(Game).where(Game.id == data.existing_game_id))
        game = result.scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    else:
        game = Game(
            title=data.game_title,
            platform="steam",
            platform_game_id=data.app_id,
            cover_image_url=cover_image_url,
            genre=genre,
        )
        db.add(game)
        await db.flush()

    # Get sort order
    existing_sets = await db.execute(
        select(TrophySet).where(TrophySet.game_id == game.id)
    )
    set_count = len(existing_sets.scalars().all())

    # Create trophy set
    trophy_set = TrophySet(
        game_id=game.id,
        name=data.trophy_set_name,
        platform_communication_id=data.app_id,
        sort_order=set_count,
    )
    db.add(trophy_set)
    await db.flush()

    for ach in steam_data["achievements"]:
        achievement = Achievement(
            game_id=game.id,
            trophy_set_id=trophy_set.id,
            title=ach["title"],
            description=ach["description"],
            platform_achievement_id=ach["platform_achievement_id"],
            icon_url=ach["icon_url"],
            rarity=ach["rarity"],
            sort_order=ach.get("sort_order", 0),
        )
        db.add(achievement)

    await db.flush()

    return {
        "message": f"Successfully imported {data.trophy_set_name} for {game.title}",
        "game_id": str(game.id),
        "trophy_set_id": str(trophy_set.id),
        "achievements_imported": steam_data["total"],
    }