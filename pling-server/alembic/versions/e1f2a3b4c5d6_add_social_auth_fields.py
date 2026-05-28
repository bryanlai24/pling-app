"""Add social auth fields to users

Revision ID: e1f2a3b4c5d6
Revises: d4e5f6a7b8c9
Create Date: 2026-05-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'e1f2a3b4c5d6'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(sa.text("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
            ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255) UNIQUE,
            ALTER COLUMN password_hash DROP NOT NULL
    """))


def downgrade() -> None:
    op.get_bind().execute(sa.text("""
        ALTER TABLE users
            DROP COLUMN IF EXISTS email_verified,
            DROP COLUMN IF EXISTS google_id,
            DROP COLUMN IF EXISTS apple_id,
            ALTER COLUMN password_hash SET NOT NULL
    """))
