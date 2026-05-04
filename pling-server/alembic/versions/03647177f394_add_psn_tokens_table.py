"""add psn_tokens table

Revision ID: 03647177f394
Revises: a9d49294645b
Create Date: 2026-04-30 21:54:49.641377

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '03647177f394'
down_revision: Union[str, None] = 'a9d49294645b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('psn_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('access_token', sa.String(length=4000), nullable=False),
        sa.Column('refresh_token', sa.String(length=4000), nullable=False),
        sa.Column('access_token_expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('refresh_token_expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('psn_tokens')