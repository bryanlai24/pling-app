"""Add email_tokens table

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-05-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'f2a3b4c5d6e7'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # Create enum type (guard against already existing)
    bind.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE email_token_type_enum AS ENUM ('verification', 'merge');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))

    # Create the table
    bind.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS email_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(255) NOT NULL UNIQUE,
            token_type email_token_type_enum NOT NULL,
            provider VARCHAR(20),
            provider_id VARCHAR(255),
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))

    # Create index
    bind.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_email_tokens_token ON email_tokens(token)
    """))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("DROP TABLE IF EXISTS email_tokens"))
    bind.execute(sa.text("DROP TYPE IF EXISTS email_token_type_enum"))
