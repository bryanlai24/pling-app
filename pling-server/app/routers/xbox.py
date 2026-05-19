import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.xbox_token import XboxToken
from app.schemas.user import UserPublic
from app.services.xbox_service import generate_auth_url, exchange_code_for_user_tokens
from app.services.sync_service import sync_xbox_game

router = APIRouter()


@router.get("/auth-url")
async def get_xbox_auth_url(current_user: User = Depends(get_current_user)):
    """Return the Microsoft OAuth URL for the user to open and authenticate."""
    return {"auth_url": generate_auth_url()}


@router.post("/connect", response_model=UserPublic)
async def connect_xbox(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exchange an OAuth code for tokens and store them against the current user.

    The user opens the auth URL, signs in, and copies the 'code' parameter
    from the redirect URL (https://login.microsoftonline.com/...?code=XXXXX).
    """
    code = data.get("code", "").strip()
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Auth code is required")

    try:
        result = await exchange_code_for_user_tokens(db, current_user.id, code)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect Xbox account: {str(e)}",
        )

    # Store gamertag on user row for display
    if result.get("gamertag"):
        current_user.xbox_gamertag = result["gamertag"]
        await db.flush()
        await db.refresh(current_user)

    return UserPublic.model_validate(current_user)


@router.delete("/disconnect", response_model=UserPublic)
async def disconnect_xbox(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove the user's Xbox token and clear their gamertag."""
    result = await db.execute(
        select(XboxToken).where(XboxToken.user_id == current_user.id).limit(1)
    )
    token = result.scalar_one_or_none()
    if token:
        await db.delete(token)

    current_user.xbox_gamertag = None
    await db.flush()
    await db.refresh(current_user)
    return UserPublic.model_validate(current_user)


@router.post("/sync/{game_id}")
async def sync_xbox_game_achievements(
    game_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sync earned Xbox achievements for a specific game into the user's achievement progress."""
    if not current_user.xbox_gamertag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Xbox account connected. Connect your Xbox account in your profile first.",
        )
    result = await sync_xbox_game(db, current_user.id, game_id)
    return result
