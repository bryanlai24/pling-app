import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func, ForeignKey, Integer, Boolean, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class TrophyType(str, enum.Enum):
    bronze = "bronze"
    silver = "silver"
    gold = "gold"
    platinum = "platinum"


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    game_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"), nullable=False
    )
    trophy_set_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trophy_sets.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    platform_achievement_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rarity: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # PSN only — null for Xbox/Steam/manual
    trophy_type: Mapped[TrophyType | None] = mapped_column(
        Enum(TrophyType, name="trophy_type_enum"), nullable=True
    )

    # Xbox only — null for PSN/Steam/manual
    gamerscore: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    game: Mapped["Game"] = relationship(back_populates="achievements")
    trophy_set: Mapped["TrophySet | None"] = relationship(back_populates="achievements")
    objectives: Mapped[list["Objective"]] = relationship(
        back_populates="achievement",
        order_by="Objective.sort_order",
        cascade="all, delete-orphan"
    )
    user_achievements: Mapped[list["UserAchievement"]] = relationship(
        back_populates="achievement", cascade="all, delete-orphan"
    )
    platform_ids: Mapped[list["AchievementPlatformId"]] = relationship(
        back_populates="achievement", cascade="all, delete-orphan"
    )

    icon_url: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Objective(Base):
    __tablename__ = "objectives"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    achievement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False
    )
    parent_objective_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("objectives.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    method: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_counter: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    counter_target: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    achievement: Mapped["Achievement"] = relationship(back_populates="objectives")
    children: Mapped[list["Objective"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="Objective.sort_order",
    )
    parent: Mapped["Objective | None"] = relationship(
        back_populates="children", remote_side="Objective.id"
    )
    user_objectives: Mapped[list["UserObjective"]] = relationship(
        back_populates="objective", cascade="all, delete-orphan"
    )

class UserAchievement(Base):
    __tablename__ = "user_achievements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    achievement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False
    )
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    progress_current: Mapped[int | None] = mapped_column(Integer, nullable=True)
    progress_target: Mapped[int | None] = mapped_column(Integer, nullable=True)

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="user_achievements")
    achievement: Mapped["Achievement"] = relationship(back_populates="user_achievements")


class UserObjective(Base):
    __tablename__ = "user_objectives"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    objective_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("objectives.id", ondelete="CASCADE"), nullable=False
    )
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    counter_current: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="user_objectives")
    objective: Mapped["Objective"] = relationship(back_populates="user_objectives")


class AchievementPlatformId(Base):
    """Maps a platform-specific achievement ID to an Achievement row.

    Allows one Achievement to be matched by multiple platforms — e.g. the same
    achievement exists on Steam (apiname "ACH_WIN_1"), Xbox (id "12345"), and
    PSN (trophyId "0"). Each row stores one platform's identifier.

    Sync services look up achievements via (platform, platform_achievement_id)
    rather than the bare platform_achievement_id on the Achievement row.
    """
    __tablename__ = "achievement_platform_ids"
    __table_args__ = (
        UniqueConstraint("platform", "platform_achievement_id", name="uq_platform_achievement"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    achievement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[str] = mapped_column(String(20), nullable=False)  # "psn" | "xbox" | "steam"
    platform_achievement_id: Mapped[str] = mapped_column(String(255), nullable=False)

    # Relationship
    achievement: Mapped["Achievement"] = relationship(back_populates="platform_ids")