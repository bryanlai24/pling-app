import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserPublic
from app.services.sync_service import sync_steam_game
from app.services.steam_service import resolve_steam_id, get_steam_display_name

router = APIRouter()


class SteamConnectRequest(BaseModel):
    steam_input: str  # steamID64, vanity name, or full profile URL


@router.post("/connect", response_model=UserPublic)
async def connect_steam(
    data: SteamConnectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Connect a Steam account by resolving any Steam URL/vanity/ID to a steamID64."""
    try:
        steam_id = await resolve_steam_id(data.steam_input)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach Steam — please try again.",
        )

    current_user.steam_id = steam_id
    current_user.steam_display_name = await get_steam_display_name(steam_id)
    await db.flush()
    await db.refresh(current_user)
    return UserPublic.model_validate(current_user)


@router.delete("/disconnect", response_model=UserPublic)
async def disconnect_steam(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect Steam account."""
    current_user.steam_id = None
    current_user.steam_display_name = None
    await db.flush()
    await db.refresh(current_user)
    return UserPublic.model_validate(current_user)


@router.post("/sync/{game_id}")
async def sync_steam_game_achievements(
    game_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sync earned Steam achievements for a specific game into the user's achievement progress."""
    if not current_user.steam_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Steam ID connected. Add your Steam ID in your profile first.",
        )
    result = await sync_steam_game(db, current_user.id, game_id)
    return result
