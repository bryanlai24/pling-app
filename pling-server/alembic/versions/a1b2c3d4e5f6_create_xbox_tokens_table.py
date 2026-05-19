"""create xbox_tokens table (was empty no-op in e5eda9b5f408)

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-05-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

revision = 'a1b2c3d4e5f6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Table may already exist on DBs that ran the original empty migration
    # and had the table created outside of Alembic (e.g. local dev volumes)
    bind = op.get_bind()
    if not inspect(bind).has_table('xbox_tokens'):
        op.create_table(
            'xbox_tokens',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('access_token', sa.String(4000), nullable=False),
            sa.Column('refresh_token', sa.String(4000), nullable=False),
            sa.Column('access_token_expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('refresh_token_expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('gamertag', sa.String(100), nullable=True),
            sa.Column('xuid', sa.String(100), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table('xbox_tokens')
