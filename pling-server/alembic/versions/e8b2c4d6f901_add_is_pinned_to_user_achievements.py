"""add is_pinned to user_achievements

Revision ID: e8b2c4d6f901
Revises: d7e3f9a1b205
Create Date: 2026-05-17

"""
from alembic import op
import sqlalchemy as sa

revision = 'e8b2c4d6f901'
down_revision = 'd7e3f9a1b205'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'user_achievements',
        sa.Column('is_pinned', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('user_achievements', 'is_pinned')
