import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import get_current_user, require_contributor, get_optional_user
from app.models.user import User
from app.schemas.achievement import (
    AchievementCreate, AchievementUpdate, AchievementResponse,
    AchievementDetail, AchievementSummary, UserAchievementResponse,
    UserAchievementUpdate,
)
from app.schemas.objective import ObjectiveWithProgress
from app.services import achievement_service, game_service

router = APIRouter()


# ── Achievements ───────────────────────────────────────────────────────────────

@router.post("", response_model=AchievementResponse, status_code=status.HTTP_201_CREATED)
async def create_achievement(
    data: AchievementCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_contributor),
):
    achievement = await achievement_service.create_achievement(db, data)
    return AchievementResponse.model_validate(achievement)


@router.get("/game/{game_id}", response_model=list[AchievementSummary])
async def list_achievements(
    game_id: uuid.UUID,
    with_progress: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    rows = await achievement_service.list_achievements_for_game(
        db, game_id, user_id=current_user.id if with_progress and current_user is not None else None
    )
    results = []
    for row in rows:
        a = row["achievement"]
        ua = row["user_achievement"]
        results.append(AchievementSummary(
            id=a.id,
            title=a.title,
            description=a.description,
            trophy_type=a.trophy_type,
            gamerscore=a.gamerscore,
            rarity=a.rarity,
            is_completed=ua.is_completed if ua else False,
            is_pinned=ua.is_pinned if ua else False,
            icon_url=a.icon_url,
            trophy_set_id=a.trophy_set_id,
            trophy_set_name=a.trophy_set.name if a.trophy_set else None,
        ))
    return results


@router.get("/{achievement_id}", response_model=AchievementDetail)
async def get_achievement(
    achievement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Full hunt screen data — achievement + all objectives + user progress."""
    data = await achievement_service.get_achievement_with_user_progress(
        db, achievement_id, user_id=current_user.id if current_user else None
    )
    a = data["achievement"]
    ua = data["user_achievement"]
    user_objectives = data["user_objectives"]

    objectives_with_progress = []
    for obj in a.objectives:
        if obj.parent_objective_id is not None:
            continue  # children are nested under their parent; skip at top level
        uo = user_objectives.get(obj.id)
        children_with_progress = [
            ObjectiveWithProgress(
                id=child.id,
                achievement_id=child.achievement_id,
                parent_objective_id=child.parent_objective_id,
                title=child.title,
                method=child.method,
                sort_order=child.sort_order,
                is_counter=child.is_counter,
                counter_target=child.counter_target,
                created_at=child.created_at,
                children=[],
                user_progress=user_objectives.get(child.id),
            )
            for child in obj.children
        ]
        obj_response = ObjectiveWithProgress(
            id=obj.id,
            achievement_id=obj.achievement_id,
            parent_objective_id=obj.parent_objective_id,
            title=obj.title,
            method=obj.method,
            sort_order=obj.sort_order,
            is_counter=obj.is_counter,
            counter_target=obj.counter_target,
            created_at=obj.created_at,
            children=children_with_progress,
            user_progress=uo,
        )
        objectives_with_progress.append(obj_response)

    return AchievementDetail(
        id=a.id,
        game_id=a.game_id,
        title=a.title,
        description=a.description,
        platform_achievement_id=a.platform_achievement_id,
        rarity=a.rarity,
        trophy_type=a.trophy_type,
        gamerscore=a.gamerscore,
        icon_url=a.icon_url,
        created_at=a.created_at,
        objectives=objectives_with_progress,
        user_progress=ua,
    )


@router.patch("/{achievement_id}", response_model=AchievementResponse)
async def update_achievement(
    achievement_id: uuid.UUID,
    data: AchievementUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_contributor),
):
    achievement = await achievement_service.update_achievement(db, achievement_id, data)
    return AchievementResponse.model_validate(achievement)


@router.delete("/{achievement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_achievement(
    achievement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_contributor),
):
    await achievement_service.delete_achievement(db, achievement_id)


# ── User achievement progress ──────────────────────────────────────────────────

@router.patch("/{achievement_id}/progress", response_model=UserAchievementResponse)
async def update_achievement_progress(
    achievement_id: uuid.UUID,
    data: UserAchievementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark an achievement complete/incomplete or update platform progress counter."""
    ua = await achievement_service.upsert_user_achievement(
        db, current_user.id, achievement_id, data
    )
    # Recalculate game completion percent
    achievement = await achievement_service.get_achievement(db, achievement_id)
    percent = await game_service.recalculate_completion(db, current_user.id, achievement.game_id)
    return UserAchievementResponse.model_validate(ua)
