import uuid
from datetime import datetime
from pydantic import Field, model_validator
from app.schemas import PlingBase
from app.schemas.objective import ObjectiveCreate, ObjectiveWithProgress
from app.models.achievement import TrophyType


# ── Request schemas ────────────────────────────────────────────────────────────

class AchievementCreate(PlingBase):
    game_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)
    platform_achievement_id: str | None = Field(None, max_length=255)
    rarity: str | None = Field(None, max_length=50)

    # PSN only
    trophy_type: TrophyType | None = None

    # Xbox only
    gamerscore: int | None = Field(None, ge=0, le=1000)

    # Optionally create objectives in the same request
    objectives: list[ObjectiveCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def platform_fields_exclusive(self) -> "AchievementCreate":
        if self.trophy_type is not None and self.gamerscore is not None:
            raise ValueError("trophy_type (PSN) and gamerscore (Xbox) are mutually exclusive")
        return self


class AchievementUpdate(PlingBase):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=1000)
    rarity: str | None = Field(None, max_length=50)
    trophy_type: TrophyType | None = None
    gamerscore: int | None = Field(None, ge=0, le=1000)


class UserAchievementUpdate(PlingBase):
    is_completed: bool | None = None
    is_pinned: bool | None = None
    progress_current: int | None = Field(None, ge=0)
    progress_target: int | None = Field(None, ge=0)
    completed_at: datetime | None = None


# ── Response schemas ───────────────────────────────────────────────────────────

class AchievementResponse(PlingBase):
    id: uuid.UUID
    game_id: uuid.UUID
    title: str
    description: str | None
    platform_achievement_id: str | None
    rarity: str | None
    trophy_type: TrophyType | None
    gamerscore: int | None
    icon_url: str | None
    created_at: datetime


class UserAchievementResponse(PlingBase):
    """Achievement + current user's completion state."""
    id: uuid.UUID
    achievement: AchievementResponse
    is_completed: bool
    is_pinned: bool = False
    progress_current: int | None
    progress_target: int | None
    completed_at: datetime | None
    updated_at: datetime


class AchievementDetail(AchievementResponse):
    """Full achievement view with objectives and user progress embedded.
    This is the primary response for the hunt screen."""
    game_title: str | None = None
    objectives: list[ObjectiveWithProgress] = []
    user_progress: UserAchievementResponse | None = None

    @property
    def objectives_completed(self) -> int:
        return sum(1 for o in self.objectives if o.user_progress and o.user_progress.is_completed)

    @property
    def objectives_total(self) -> int:
        return len(self.objectives)


class AchievementSummary(PlingBase):
    id: uuid.UUID
    title: str
    description: str | None
    trophy_type: TrophyType | None
    gamerscore: int | None
    rarity: str | None
    is_completed: bool = False
    is_pinned: bool = False
    icon_url: str | None = None
    trophy_set_id: uuid.UUID | None = None
    trophy_set_name: str | None = None
