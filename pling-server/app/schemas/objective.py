import uuid
from datetime import datetime
from pydantic import Field, model_validator
from app.schemas import PlingBase


# ── Request schemas ────────────────────────────────────────────────────────────

class ObjectiveCreate(PlingBase):
    title: str = Field(..., min_length=1, max_length=255)
    method: str | None = Field(None, max_length=2000)
    sort_order: int = Field(0, ge=0)
    is_counter: bool = False
    counter_target: int | None = Field(None, gt=0)

    @model_validator(mode="after")
    def counter_target_required_when_counter(self) -> "ObjectiveCreate":
        if self.is_counter and self.counter_target is None:
            raise ValueError("counter_target is required when is_counter is True")
        if not self.is_counter and self.counter_target is not None:
            raise ValueError("counter_target should only be set when is_counter is True")
        return self


class ObjectiveUpdate(PlingBase):
    title: str | None = Field(None, min_length=1, max_length=255)
    method: str | None = Field(None, max_length=2000)
    sort_order: int | None = Field(None, ge=0)
    is_counter: bool | None = None
    counter_target: int | None = Field(None, gt=0)


class UserObjectiveUpdate(PlingBase):
    is_completed: bool | None = None
    counter_current: int | None = Field(None, ge=0)


# ── Response schemas ───────────────────────────────────────────────────────────

class ObjectiveResponse(PlingBase):
    id: uuid.UUID
    achievement_id: uuid.UUID
    title: str
    method: str | None
    sort_order: int
    is_counter: bool
    counter_target: int | None
    created_at: datetime


class UserObjectiveResponse(PlingBase):
    """Objective + current user's progress on it."""
    id: uuid.UUID
    objective: ObjectiveResponse
    is_completed: bool
    counter_current: int
    completed_at: datetime | None
    updated_at: datetime


class ObjectiveWithProgress(ObjectiveResponse):
    """Objective with user progress embedded — used inside achievement detail views."""
    user_progress: UserObjectiveResponse | None = None
