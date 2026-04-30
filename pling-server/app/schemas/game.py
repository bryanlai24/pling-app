import uuid
from datetime import datetime
from pydantic import Field, HttpUrl, field_validator
from app.schemas import PlingBase
from app.models.game import Platform


# ── Request schemas ────────────────────────────────────────────────────────────

class GameCreate(PlingBase):
    title: str = Field(..., min_length=1, max_length=255)
    platform: Platform
    platform_game_id: str | None = Field(None, max_length=255)
    cover_image_url: str | None = Field(None, max_length=500)
    genre: str | None = Field(None, max_length=100)


class GameUpdate(PlingBase):
    title: str | None = Field(None, min_length=1, max_length=255)
    cover_image_url: str | None = Field(None, max_length=500)
    genre: str | None = Field(None, max_length=100)


# ── User-game link schemas ─────────────────────────────────────────────────────

class UserGameCreate(PlingBase):
    game_id: uuid.UUID


class UserGameUpdate(PlingBase):
    status: str | None = None
    gamerscore_earned: int | None = Field(None, ge=0)
    gamerscore_total: int | None = Field(None, ge=0)
    started_at: datetime | None = None
    completed_at: datetime | None = None


# ── Response schemas ───────────────────────────────────────────────────────────

class GameResponse(PlingBase):
    id: uuid.UUID
    title: str
    platform: Platform
    platform_game_id: str | None
    cover_image_url: str | None
    genre: str | None
    created_at: datetime


class UserGameResponse(PlingBase):
    """Game + the current user's progress on it."""
    id: uuid.UUID
    game: GameResponse
    status: str
    completion_percent: int
    gamerscore_earned: int | None
    gamerscore_total: int | None
    started_at: datetime | None
    completed_at: datetime | None
    updated_at: datetime


class GameWithProgress(GameResponse):
    """Game response with optional user progress embedded."""
    user_progress: UserGameResponse | None = None
