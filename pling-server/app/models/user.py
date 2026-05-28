import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func, Enum, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    user = "user"
    contributor = "contributor"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Email verification
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    # Social auth provider IDs
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    apple_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    discord_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum"),
        default=UserRole.user,
        nullable=False,
        server_default="user",
    )

    # Platform sync identifiers (all optional)
    psn_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    psn_account_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    psn_npsso: Mapped[str | None] = mapped_column(String(500), nullable=True)
    xbox_gamertag: Mapped[str | None] = mapped_column(String(100), nullable=True)
    steam_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    steam_display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user_games: Mapped[list["UserGame"]] = relationship(back_populates="user")
    user_achievements: Mapped[list["UserAchievement"]] = relationship(back_populates="user")
    user_objectives: Mapped[list["UserObjective"]] = relationship(back_populates="user")