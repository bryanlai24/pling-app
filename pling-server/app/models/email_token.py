import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func, ForeignKey, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
import enum


class EmailTokenType(str, enum.Enum):
    verification = "verification"  # confirm new account email
    merge = "merge"                # confirm OAuth account merge
    setup = "setup"                # complete social signup (choose username)


class EmailToken(Base):
    __tablename__ = "email_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Nullable for setup tokens — no user exists yet
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    token_type: Mapped[EmailTokenType] = mapped_column(
        Enum(EmailTokenType, name="email_token_type_enum"), nullable=False
    )
    # For merge tokens: provider + provider_id waiting to be linked
    # For setup tokens: same, plus extra_json carries email/email_verified/display_name
    provider: Mapped[str | None] = mapped_column(String(20), nullable=True)
    provider_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extra_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship()
