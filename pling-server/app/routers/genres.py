import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import get_optional_user, require_contributor
from app.models.user import User
from app.schemas.genre import GenreCreate, GenreResponse
from app.schemas.game import GameResponse
from app.services import genre_service

router = APIRouter()


@router.post("", response_model=GenreResponse, status_code=status.HTTP_201_CREATED)
async def create_genre(
    data: GenreCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_contributor),
):
    genre = await genre_service.create_genre(db, data)
    return GenreResponse.model_validate(genre)


@router.get("", response_model=list[GenreResponse])
async def list_genres(
    db: AsyncSession = Depends(get_db),
    _: User | None = Depends(get_optional_user),
):
    genres = await genre_service.list_genres(db)
    return [GenreResponse.model_validate(g) for g in genres]


@router.get("/{genre_id}/games", response_model=list[GameResponse])
async def list_games_by_genre(
    genre_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User | None = Depends(get_optional_user),
):
    games = await genre_service.list_games_by_genre(db, genre_id)
    return [GameResponse.model_validate(g) for g in games]
