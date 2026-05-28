import uuid
import secrets
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from fastapi import HTTPException, status

from app.models.user import User
from app.models.email_token import EmailToken, EmailTokenType
from app.models.achievement import Achievement, UserAchievement, TrophyType
from app.models.progress import UserGame, GameStatus
from app.models.game import Game, Platform
from app.schemas.user import UserRegister, UserUpdate, PasswordChange, UserStats, PsnStats, XboxStats, SteamStats
from app.auth.dependencies import hash_password, verify_password


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def create_verification_token(db: AsyncSession, user: User) -> str:
    """Create a fresh email verification token, deleting any existing ones."""
    await db.execute(
        delete(EmailToken).where(
            EmailToken.user_id == user.id,
            EmailToken.token_type == EmailTokenType.verification,
        )
    )
    token = secrets.token_urlsafe(32)
    db.add(EmailToken(
        user_id=user.id,
        token=token,
        token_type=EmailTokenType.verification,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    ))
    await db.flush()
    return token


async def create_merge_token(db: AsyncSession, user: User, provider: str, provider_id: str) -> str:
    """Create a short-lived merge confirmation token."""
    await db.execute(
        delete(EmailToken).where(
            EmailToken.user_id == user.id,
            EmailToken.token_type == EmailTokenType.merge,
        )
    )
    token = secrets.token_urlsafe(32)
    db.add(EmailToken(
        user_id=user.id,
        token=token,
        token_type=EmailTokenType.merge,
        provider=provider,
        provider_id=provider_id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    ))
    await db.flush()
    return token


async def register_user(db: AsyncSession, data: UserRegister) -> User:
    if await get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    if await get_user_by_username(db, data.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken",
        )
    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        email_verified=False,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return user


async def update_user(db: AsyncSession, user: User, data: UserUpdate) -> User:
    updates = data.model_dump(exclude_unset=True)

    if "email" in updates and updates["email"] != user.email:
        if await get_user_by_email(db, updates["email"]):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )

    if "username" in updates and updates["username"] != user.username:
        if await get_user_by_username(db, updates["username"]):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This username is already taken",
            )

    for field, value in updates.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return user


async def change_password(db: AsyncSession, user: User, data: PasswordChange) -> None:
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    user.password_hash = hash_password(data.new_password)
    await db.flush()


async def get_user_stats(db: AsyncSession, user_id: uuid.UUID) -> UserStats:
    # Games tracked = all UserGame rows for this user
    games_result = await db.execute(
        select(func.count()).where(UserGame.user_id == user_id)
    )
    games_tracked = games_result.scalar() or 0

    # Games fully completed = platinum or full_completion status across all platforms
    completed_result = await db.execute(
        select(func.count())
        .where(UserGame.user_id == user_id)
        .where(UserGame.status.in_([GameStatus.platinum, GameStatus.full_completion]))
    )
    games_fully_completed = completed_result.scalar() or 0

    # ── PSN stats ──────────────────────────────────────────────────────────────
    # Only populate if user has any PSN games in their library
    psn_games_result = await db.execute(
        select(func.count())
        .select_from(UserGame)
        .join(Game, Game.id == UserGame.game_id)
        .where(UserGame.user_id == user_id)
        .where(Game.platform == Platform.psn)
    )
    psn_game_count = psn_games_result.scalar() or 0

    psn_stats = None
    if psn_game_count > 0:
        trophies_result = await db.execute(
            select(func.count())
            .select_from(UserAchievement)
            .join(Achievement, Achievement.id == UserAchievement.achievement_id)
            .join(Game, Game.id == Achievement.game_id)
            .where(UserAchievement.user_id == user_id)
            .where(UserAchievement.is_completed == True)
            .where(Game.platform == Platform.psn)
        )
        platinums_result = await db.execute(
            select(func.count())
            .select_from(UserAchievement)
            .join(Achievement, Achievement.id == UserAchievement.achievement_id)
            .join(Game, Game.id == Achievement.game_id)
            .where(UserAchievement.user_id == user_id)
            .where(UserAchievement.is_completed == True)
            .where(Game.platform == Platform.psn)
            .where(Achievement.trophy_type == TrophyType.platinum)
        )
        psn_stats = PsnStats(
            trophies_earned=trophies_result.scalar() or 0,
            platinums=platinums_result.scalar() or 0,
        )

    # ── Xbox stats ─────────────────────────────────────────────────────────────
    xbox_result = await db.execute(
        select(
            func.coalesce(func.sum(UserGame.gamerscore_earned), 0),
            func.coalesce(func.sum(UserGame.gamerscore_total), 0),
        )
        .select_from(UserGame)
        .join(Game, Game.id == UserGame.game_id)
        .where(UserGame.user_id == user_id)
        .where(Game.platform == Platform.xbox)
    )
    xbox_row = xbox_result.one_or_none()
    xbox_stats = None
    if xbox_row and (xbox_row[0] or xbox_row[1]):
        xbox_stats = XboxStats(
            gamerscore_earned=xbox_row[0] or 0,
            gamerscore_total=xbox_row[1] or 0,
        )

    # ── Steam stats ────────────────────────────────────────────────────────────
    steam_result = await db.execute(
        select(func.count())
        .select_from(UserGame)
        .join(Game, Game.id == UserGame.game_id)
        .where(UserGame.user_id == user_id)
        .where(Game.platform == Platform.steam)
        .where(UserGame.status == GameStatus.full_completion)
    )
    steam_completed = steam_result.scalar() or 0
    steam_stats = SteamStats(games_completed=steam_completed) if steam_completed > 0 else None

    return UserStats(
        games_tracked=games_tracked,
        games_fully_completed=games_fully_completed,
        psn=psn_stats,
        xbox=xbox_stats,
        steam=steam_stats,
    )
