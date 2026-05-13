import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Integer, case
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.achievement import Achievement, Objective, UserAchievement, UserObjective
from app.schemas.achievement import AchievementCreate, AchievementUpdate, UserAchievementUpdate
from app.schemas.objective import ObjectiveCreate, ObjectiveUpdate, UserObjectiveUpdate


# ── Achievements ───────────────────────────────────────────────────────────────

async def create_achievement(db: AsyncSession, data: AchievementCreate) -> Achievement:
    objectives_data = data.objectives
    achievement = Achievement(
        **data.model_dump(exclude={"objectives"})
    )
    db.add(achievement)
    await db.flush()

    for i, obj_data in enumerate(objectives_data):
        obj = Objective(
            achievement_id=achievement.id,
            **obj_data.model_dump(),
        )
        if obj.sort_order == 0 and i > 0:
            obj.sort_order = i
        db.add(obj)

    await db.flush()
    await db.refresh(achievement, ["objectives"])
    return achievement


async def get_achievement(db: AsyncSession, achievement_id: uuid.UUID) -> Achievement:
    result = await db.execute(
        select(Achievement)
        .where(Achievement.id == achievement_id)
        .options(selectinload(Achievement.objectives))
    )
    achievement = result.scalar_one_or_none()
    if not achievement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Achievement not found"
        )
    return achievement


async def get_achievement_with_user_progress(
    db: AsyncSession, achievement_id: uuid.UUID, user_id: uuid.UUID
) -> dict:
    achievement = await get_achievement(db, achievement_id)

    ua_result = await db.execute(
        select(UserAchievement).where(
            UserAchievement.achievement_id == achievement_id,
            UserAchievement.user_id == user_id,
        )
    )
    user_achievement = ua_result.scalar_one_or_none()

    objective_ids = [o.id for o in achievement.objectives]
    uo_result = await db.execute(
        select(UserObjective).where(
            UserObjective.objective_id.in_(objective_ids),
            UserObjective.user_id == user_id,
        )
    )
    user_objectives = {uo.objective_id: uo for uo in uo_result.scalars().all()}

    return {
        "achievement": achievement,
        "user_achievement": user_achievement,
        "user_objectives": user_objectives,
    }


async def list_achievements_for_game(
    db: AsyncSession,
    game_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
) -> list[dict]:
    from sqlalchemy import Integer
    result = await db.execute(
        select(Achievement)
        .where(Achievement.game_id == game_id)
        .options(selectinload(Achievement.trophy_set))
        .order_by(
            Achievement.sort_order.asc(),
            case(
                (Achievement.platform_achievement_id.regexp_match(r'^\d+$'),
                Achievement.platform_achievement_id.cast(Integer)),
                else_=None
            ).asc().nulls_last(),
            Achievement.title.asc()
        )
    )
    achievements = result.scalars().all()

    if not user_id:
        return [{"achievement": a, "user_achievement": None} for a in achievements]

    ua_result = await db.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id.in_([a.id for a in achievements]),
        )
    )
    user_map = {ua.achievement_id: ua for ua in ua_result.scalars().all()}

    return [
        {"achievement": a, "user_achievement": user_map.get(a.id)}
        for a in achievements
    ]


async def update_achievement(
    db: AsyncSession, achievement_id: uuid.UUID, data: AchievementUpdate
) -> Achievement:
    achievement = await get_achievement(db, achievement_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(achievement, field, value)
    await db.flush()
    await db.refresh(achievement, ["objectives"])
    return achievement


async def delete_achievement(db: AsyncSession, achievement_id: uuid.UUID) -> None:
    achievement = await get_achievement(db, achievement_id)
    await db.delete(achievement)


# ── User achievement progress ──────────────────────────────────────────────────

async def upsert_user_achievement(
    db: AsyncSession,
    user_id: uuid.UUID,
    achievement_id: uuid.UUID,
    data: UserAchievementUpdate,
) -> UserAchievement:
    result = await db.execute(
        select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id == achievement_id,
        )
    )
    ua = result.scalar_one_or_none()

    if not ua:
        ua = UserAchievement(user_id=user_id, achievement_id=achievement_id)
        db.add(ua)

    updates = data.model_dump(exclude_unset=True)

    if updates.get("is_completed") is True and not ua.completed_at:
        ua.completed_at = datetime.now(timezone.utc)
    elif updates.get("is_completed") is False:
        ua.completed_at = None

    for field, value in updates.items():
        setattr(ua, field, value)

    await db.flush()
    await db.refresh(ua)
    result = await db.execute(
        select(UserAchievement)
        .where(UserAchievement.id == ua.id)
        .options(selectinload(UserAchievement.achievement))
    )
    return result.scalar_one()


# ── Objectives ─────────────────────────────────────────────────────────────────

async def create_objective(
    db: AsyncSession, achievement_id: uuid.UUID, data: ObjectiveCreate
) -> Objective:
    await get_achievement(db, achievement_id)
    obj = Objective(achievement_id=achievement_id, **data.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def get_objective(db: AsyncSession, objective_id: uuid.UUID) -> Objective:
    result = await db.execute(
        select(Objective).where(Objective.id == objective_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Objective not found"
        )
    return obj


async def update_objective(
    db: AsyncSession, objective_id: uuid.UUID, data: ObjectiveUpdate
) -> Objective:
    obj = await get_objective(db, objective_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


async def delete_objective(db: AsyncSession, objective_id: uuid.UUID) -> None:
    obj = await get_objective(db, objective_id)
    await db.delete(obj)


async def reorder_objectives(
    db: AsyncSession, achievement_id: uuid.UUID, ordered_ids: list[uuid.UUID]
) -> list[Objective]:
    result = await db.execute(
        select(Objective).where(Objective.achievement_id == achievement_id)
    )
    objectives = {o.id: o for o in result.scalars().all()}

    for i, obj_id in enumerate(ordered_ids):
        if obj_id not in objectives:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Objective {obj_id} does not belong to this achievement",
            )
        objectives[obj_id].sort_order = i

    await db.flush()
    return sorted(objectives.values(), key=lambda o: o.sort_order)


# ── User objective progress ────────────────────────────────────────────────────

async def upsert_user_objective(
    db: AsyncSession,
    user_id: uuid.UUID,
    objective_id: uuid.UUID,
    data: UserObjectiveUpdate,
) -> UserObjective:
    result = await db.execute(
        select(UserObjective).where(
            UserObjective.user_id == user_id,
            UserObjective.objective_id == objective_id,
        )
    )
    uo = result.scalar_one_or_none()

    if not uo:
        uo = UserObjective(user_id=user_id, objective_id=objective_id)
        db.add(uo)

    updates = data.model_dump(exclude_unset=True)

    if "counter_current" in updates:
        obj = await get_objective(db, objective_id)
        if obj.is_counter and obj.counter_target:
            if updates["counter_current"] >= obj.counter_target:
                uo.is_completed = True
                uo.completed_at = uo.completed_at or datetime.now(timezone.utc)

    if updates.get("is_completed") is True and not uo.completed_at:
        uo.completed_at = datetime.now(timezone.utc)
    elif updates.get("is_completed") is False:
        uo.completed_at = None

    for field, value in updates.items():
        setattr(uo, field, value)

    await db.flush()
    await db.refresh(uo)
    # Eagerly load the objective relationship
    result = await db.execute(
        select(UserObjective)
        .where(UserObjective.id == uo.id)
        .options(selectinload(UserObjective.objective))
    )
    return result.scalar_one()