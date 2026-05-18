import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserPublic
from app.services.psn_connect_service import connect_psn_account
from app.services.sync_service import sync_psn_game

router = APIRouter()


class PSNConnectRequest(BaseModel):
    npsso_token: str


@router.post("/connect", response_model=UserPublic)
async def connect_psn(
    data: PSNConnectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Connect a PSN account using an NPSSO token.
    The token is used once to fetch account info and then discarded."""
    user = await connect_psn_account(db, current_user, data.npsso_token)
    return UserPublic.model_validate(user)


@router.delete("/disconnect", response_model=UserPublic)
async def disconnect_psn(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect PSN account."""
    current_user.psn_id = None
    current_user.psn_account_id = None
    await db.flush()
    await db.refresh(current_user)
    return UserPublic.model_validate(current_user)


@router.post("/sync/{game_id}")
async def sync_psn_game_trophies(
    game_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sync earned PSN trophies for a specific game into the user's achievement progress."""
    if not current_user.psn_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No PSN account connected. Connect your PSN account in your profile first.",
        )
    result = await sync_psn_game(db, current_user.id, game_id)
    return result