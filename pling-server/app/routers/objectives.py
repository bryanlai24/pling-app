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


# ── Objectives (contributor/admin only) ────────────────────────────────────────

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
    return ObjectiveResponse(
        id=obj.id,
        achievement_id=obj.achievement_id,
        parent_objective_id=obj.parent_objective_id,
        title=obj.title,
        method=obj.method,
        image_url=obj.image_url,
        video_url=obj.video_url,
        sort_order=obj.sort_order,
        is_counter=obj.is_counter,
        counter_target=obj.counter_target,
        created_at=obj.created_at,
        children=[],
    )


@router.patch("/{objective_id}", response_model=ObjectiveResponse)
async def update_objective(
    objective_id: uuid.UUID,
    data: ObjectiveUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_contributor),
):
    obj = await achievement_service.update_objective(db, objective_id, data)
    return ObjectiveResponse(
        id=obj.id,
        achievement_id=obj.achievement_id,
        parent_objective_id=obj.parent_objective_id,
        title=obj.title,
        method=obj.method,
        image_url=obj.image_url,
        video_url=obj.video_url,
        sort_order=obj.sort_order,
        is_counter=obj.is_counter,
        counter_target=obj.counter_target,
        created_at=obj.created_at,
        children=[],
    )


@router.delete("/{objective_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_objective(
    objective_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_contributor),
):
    await achievement_service.delete_objective(db, objective_id)


@router.post("/achievement/{achievement_id}/reorder", response_model=list[ObjectiveResponse])
async def reorder_objectives(
    achievement_id: uuid.UUID,
    ordered_ids: list[uuid.UUID],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_contributor),
):
    objectives = await achievement_service.reorder_objectives(db, achievement_id, ordered_ids)
    return [
        ObjectiveResponse(
            id=o.id,
            achievement_id=o.achievement_id,
            parent_objective_id=o.parent_objective_id,
            title=o.title,
            method=o.method,
            image_url=o.image_url,
            video_url=o.video_url,
            sort_order=o.sort_order,
            is_counter=o.is_counter,
            counter_target=o.counter_target,
            created_at=o.created_at,
            children=[],
        )
        for o in objectives
    ]


# ── User objective progress (all authenticated users) ─────────────────────────

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
    obj = uo.objective
    return UserObjectiveResponse(
        id=uo.id,
        objective=ObjectiveResponse(
            id=obj.id,
            achievement_id=obj.achievement_id,
            parent_objective_id=obj.parent_objective_id,
            title=obj.title,
            method=obj.method,
            image_url=obj.image_url,
            video_url=obj.video_url,
            sort_order=obj.sort_order,
            is_counter=obj.is_counter,
            counter_target=obj.counter_target,
            created_at=obj.created_at,
            children=[],
        ),
        is_completed=uo.is_completed,
        counter_current=uo.counter_current,
        completed_at=uo.completed_at,
        updated_at=uo.updated_at,
    )