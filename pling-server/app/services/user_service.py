import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.user import UserRegister, UserUpdate, PasswordChange
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
    )
    db.add(user)
    await db.flush()  # get the ID without committing
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
