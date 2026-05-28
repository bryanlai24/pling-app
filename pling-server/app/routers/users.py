from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.auth.jwt import create_access_token
from app.models.user import User
from app.models.email_token import EmailToken, EmailTokenType
from app.schemas.user import (
    UserRegister, UserLogin, UserUpdate,
    UserPublic, TokenResponse, PasswordChange, UserStats,
)
from app.services import user_service
from app.services.email_service import send_verification_email

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    user = await user_service.register_user(db, data)
    # Send verification email (non-blocking — failure shouldn't block registration)
    try:
        token = await user_service.create_verification_token(db, user)
        await send_verification_email(user.email, user.username, token)
    except Exception as e:
        print(f"[register] Failed to send verification email: {e}")
    jwt = create_access_token(user.id)
    return TokenResponse(access_token=jwt, user=UserPublic.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await user_service.authenticate_user(db, data.email, data.password)
    jwt = create_access_token(user.id)
    return TokenResponse(access_token=jwt, user=UserPublic.model_validate(user))


@router.post("/send-verification", status_code=status.HTTP_204_NO_CONTENT)
async def send_verification(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resend verification email."""
    if current_user.email_verified:
        return  # already verified — no-op
    try:
        token = await user_service.create_verification_token(db, current_user)
        await send_verification_email(current_user.email, current_user.username, token)
    except Exception as e:
        print(f"[send-verification] Failed: {e}")


@router.get("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Confirm email via token from verification link."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(EmailToken).where(
            EmailToken.token == token,
            EmailToken.token_type == EmailTokenType.verification,
            EmailToken.expires_at > now,
        )
    )
    email_token = result.scalar_one_or_none()
    if not email_token:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")

    user_result = await db.execute(select(User).where(User.id == email_token.user_id))
    user = user_result.scalar_one_or_none()
    if user:
        user.email_verified = True

    await db.execute(delete(EmailToken).where(EmailToken.id == email_token.id))
    await db.flush()

    jwt = create_access_token(user.id)
    return TokenResponse(access_token=jwt, user=UserPublic.model_validate(user))


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
