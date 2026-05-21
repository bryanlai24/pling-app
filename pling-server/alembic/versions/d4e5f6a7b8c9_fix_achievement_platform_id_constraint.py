"""Fix achievement_platform_ids unique constraint

The old constraint (platform, platform_achievement_id) was globally unique,
but platform achievement IDs are only unique per game (e.g. Xbox achievement
ID "36" can exist on multiple games). The correct constraint is
(achievement_id, platform) — one platform entry per achievement per platform.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-20
"""
from alembic import op

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('uq_platform_achievement', 'achievement_platform_ids', type_='unique')
    op.create_unique_constraint('uq_achievement_platform', 'achievement_platform_ids', ['achievement_id', 'platform'])


def downgrade():
    op.drop_constraint('uq_achievement_platform', 'achievement_platform_ids', type_='unique')
    op.create_unique_constraint('uq_platform_achievement', 'achievement_platform_ids', ['platform', 'platform_achievement_id'])
