import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.auth.dependencies import get_current_user, get_optional_user, require_contributor
from app.models.user import User
from app.schemas.game import (
    GameCreate, GameUpdate, GameResponse,
    UserGameCreate, UserGameUpdate, UserGameResponse,
)
from app.schemas.genre import GameGenresUpdate
from app.services import game_service, genre_service

router = APIRouter()


# ── Game catalogue (shared, not user-specific) ─────────────────────────────────

@router.post("", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def create_game(
    data: GameCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),  # auth required
):
    game = await game_service.create_game(db, data)
    return GameResponse.model_validate(game)


@router.get("", response_model=list[GameResponse])
async def list_games(
    platform: str | None = Query(None, description="Filter by platform: psn, xbox, steam, manual"),
    db: AsyncSession = Depends(get_db),
    _: User | None = Depends(get_optional_user),
):
    games = await game_service.list_games(db, platform=platform)
    return [GameResponse.model_validate(g) for g in games]


@router.get("/{game_id}", response_model=GameResponse)
async def get_game(
    game_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User | None = Depends(get_optional_user),
):
    game = await game_service.get_game(db, game_id)
    return GameResponse.model_validate(game)


@router.patch("/{game_id}", response_model=GameResponse)
async def update_game(
    game_id: uuid.UUID,
    data: GameUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    game = await game_service.update_game(db, game_id, data)
    return GameResponse.model_validate(game)


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_game(
    game_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await game_service.delete_game(db, game_id)


# ── User library (personal progress) ──────────────────────────────────────────

@router.get("/library/me", response_model=list[UserGameResponse])
async def get_my_library(
    status: str | None = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_games = await game_service.get_user_library(db, current_user.id, status=status)
    return [UserGameResponse.model_validate(ug) for ug in user_games]


@router.post("/library", response_model=UserGameResponse, status_code=status.HTTP_201_CREATED)
async def add_to_library(
    data: UserGameCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ug = await game_service.add_game_to_library(db, current_user.id, data)
    return UserGameResponse.model_validate(ug)


@router.get("/library/{game_id}", response_model=UserGameResponse)
async def get_library_entry(
    game_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ug = await game_service.get_user_game(db, current_user.id, game_id)
    return UserGameResponse.model_validate(ug)


@router.patch("/library/{game_id}", response_model=UserGameResponse)
async def update_library_entry(
    game_id: uuid.UUID,
    data: UserGameUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ug = await game_service.update_user_game(db, current_user.id, game_id, data)
    return UserGameResponse.model_validate(ug)


@router.delete("/library/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_library(
    game_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await game_service.remove_game_from_library(db, current_user.id, game_id)


# ── Genres ──────────────────────────────────────────────────────────────────────
@router.put("/{game_id}/genres", response_model=GameResponse)
async def update_game_genres(
    game_id: uuid.UUID,
    data: GameGenresUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_contributor),
):
    game = await genre_service.update_game_genres(db, game_id, data.genre_ids)
    return GameResponse.model_validate(game)