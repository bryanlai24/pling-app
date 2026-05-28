"""Add setup token support to email_tokens

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-05-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'a3b4c5d6e7f8'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # Add 'setup' to the enum
    bind.execute(sa.text("ALTER TYPE email_token_type_enum ADD VALUE IF NOT EXISTS 'setup'"))

    # Make user_id nullable (setup tokens have no user yet)
    bind.execute(sa.text(
        "ALTER TABLE email_tokens ALTER COLUMN user_id DROP NOT NULL"
    ))

    # Add extra_json column for setup token payload
    bind.execute(sa.text(
        "ALTER TABLE email_tokens ADD COLUMN IF NOT EXISTS extra_json JSONB"
    ))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("ALTER TABLE email_tokens DROP COLUMN IF EXISTS extra_json"))
    # Note: PostgreSQL doesn't support removing enum values, so we leave the enum as-is
    bind.execute(sa.text("ALTER TABLE email_tokens ALTER COLUMN user_id SET NOT NULL"))
