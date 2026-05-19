"""add xbox_tokens table

Revision ID: e5eda9b5f408
Revises: 0d0219d8a35b
Create Date: 2026-05-06 05:01:55.402134

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e5eda9b5f408'
down_revision: Union[str, None] = '0d0219d8a35b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'xbox_tokens',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
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
