from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.auth.jwt import create_access_token
from app.models.user import User
from app.schemas.user import (
    UserRegister, UserLogin, UserUpdate,
    UserPublic, TokenResponse, PasswordChange, UserStats,
)
from app.services import user_service

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    user = await user_service.register_user(db, data)
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await user_service.authenticate_user(db, data.email, data.password)
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserPublic.model_validate(current_user)


@router.patch("/me", response_model=UserPublic)
async def update_me(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = await user_service.update_user(db, current_user, data)
    return UserPublic.model_validate(user)


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    data: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await user_service.change_password(db, current_user, data)


@router.get("/me/stats", response_model=UserStats)
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await user_service.get_user_stats(db, current_user.id)
