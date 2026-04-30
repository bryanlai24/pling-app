import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import get_current_user, require_contributor
from app.models.user import User
from app.schemas.objective import (
    ObjectiveCreate, ObjectiveUpdate, ObjectiveResponse,
    UserObjectiveUpdate, UserObjectiveResponse,
)
from app.services import achievement_service

router = APIRouter()


# ── Objectives ─────────────────────────────────────────────────────────────────

@router.post(
    "/achievement/{achievement_id}",
    response_model=ObjectiveResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_objective(
    achievement_id: uuid.UUID,
    data: ObjectiveCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_contributor),
):
    obj = await achievement_service.create_objective(db, achievement_id, data)
    return ObjectiveResponse.model_validate(obj)


@router.patch("/{objective_id}", response_model=ObjectiveResponse)
async def update_objective(
    objective_id: uuid.UUID,
    data: ObjectiveUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    obj = await achievement_service.update_objective(db, objective_id, data)
    return ObjectiveResponse.model_validate(obj)


@router.delete("/{objective_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_objective(
    objective_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await achievement_service.delete_objective(db, objective_id)


@router.post("/achievement/{achievement_id}/reorder", response_model=list[ObjectiveResponse])
async def reorder_objectives(
    achievement_id: uuid.UUID,
    ordered_ids: list[uuid.UUID],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Pass an ordered list of objective IDs to set their sort_order."""
    objectives = await achievement_service.reorder_objectives(db, achievement_id, ordered_ids)
    return [ObjectiveResponse.model_validate(o) for o in objectives]


# ── User objective progress ────────────────────────────────────────────────────

@router.patch("/{objective_id}/progress", response_model=UserObjectiveResponse)
async def update_objective_progress(
    objective_id: uuid.UUID,
    data: UserObjectiveUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tick a checkbox objective or increment a counter objective."""
    uo = await achievement_service.upsert_user_objective(
        db, current_user.id, objective_id, data
    )
    return UserObjectiveResponse.model_validate(uo)
