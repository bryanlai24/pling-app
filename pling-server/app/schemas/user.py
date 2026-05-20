import uuid
from datetime import datetime
from pydantic import EmailStr, Field, field_validator
from app.schemas import PlingBase
from app.models.user import UserRole


class UserRegister(PlingBase):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username may only contain letters, numbers, hyphens, and underscores")
        return v.lower()


class UserLogin(PlingBase):
    email: EmailStr
    password: str


class UserUpdate(PlingBase):
    username: str | None = Field(None, min_length=3, max_length=50)
    email: EmailStr | None = None
    psn_id: str | None = Field(None, max_length=100)
    xbox_gamertag: str | None = Field(None, max_length=100)
    steam_id: str | None = Field(None, max_length=100)


class PasswordChange(PlingBase):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


class UserPublic(PlingBase):
    id: uuid.UUID
    username: str
    email: str
    role: UserRole
    psn_id: str | None
    psn_account_id: str | None
    xbox_gamertag: str | None
    steam_id: str | None
    steam_display_name: str | None
    created_at: datetime


class UserSummary(PlingBase):
    id: uuid.UUID
    username: str
    role: UserRole


class PsnStats(PlingBase):
    platinums: int
    trophies_earned: int


class XboxStats(PlingBase):
    gamerscore_earned: int
    gamerscore_total: int


class SteamStats(PlingBase):
    games_completed: int


class UserStats(PlingBase):
    games_tracked: int
    games_fully_completed: int  # across all platforms (platinum or full_completion status)
    psn: PsnStats | None = None
    xbox: XboxStats | None = None
    steam: SteamStats | None = None


class TokenResponse(PlingBase):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic