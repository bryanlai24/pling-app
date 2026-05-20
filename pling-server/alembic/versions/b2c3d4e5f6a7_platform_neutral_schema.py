"""Platform-neutral game schema

- Add trophy_sets.platform column (nullable)
- Backfill trophy_sets.platform from games.platform
- Create achievement_platform_ids table
- Backfill achievement_platform_ids from achievements.platform_achievement_id
- Make games.platform nullable

Revision ID: b2c3d4e5f6a7
Revises: c2d3e4f5a6b7
Create Date: 2026-05-19

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add trophy_sets.platform (nullable — reuses existing platform_enum)
    conn.execute(sa.text("""
        ALTER TABLE trophy_sets
        ADD COLUMN IF NOT EXISTS platform platform_enum NULL
    """))

    # 2. Backfill: set trophy_sets.platform = games.platform for all existing rows
    conn.execute(sa.text("""
        UPDATE trophy_sets ts
        SET platform = g.platform
        FROM games g
        WHERE ts.game_id = g.id
          AND g.platform IS NOT NULL
          AND ts.platform IS NULL
    """))

    # 3. Create achievement_platform_ids table
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS achievement_platform_ids (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
            platform VARCHAR(20) NOT NULL,
            platform_achievement_id VARCHAR(255) NOT NULL,
            CONSTRAINT uq_platform_achievement UNIQUE (platform, platform_achievement_id)
        )
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_achievement_platform_ids_achievement_id
        ON achievement_platform_ids (achievement_id)
    """))

    # 4. Backfill achievement_platform_ids from existing achievements
    #    Only for achievements that have a platform_achievement_id and belong to
    #    a trophy set that now has a platform.
    conn.execute(sa.text("""
        INSERT INTO achievement_platform_ids (id, achievement_id, platform, platform_achievement_id)
        SELECT
            gen_random_uuid(),
            a.id,
            ts.platform::varchar,
            a.platform_achievement_id
        FROM achievements a
        JOIN trophy_sets ts ON a.trophy_set_id = ts.id
        WHERE a.platform_achievement_id IS NOT NULL
          AND ts.platform IS NOT NULL
        ON CONFLICT (platform, platform_achievement_id) DO NOTHING
    """))

    # 5. Make games.platform nullable
    conn.execute(sa.text("""
        ALTER TABLE games
        ALTER COLUMN platform DROP NOT NULL
    """))


def downgrade() -> None:
    conn = op.get_bind()

    # Restore NOT NULL on games.platform (set nulls to 'manual' first)
    conn.execute(sa.text("UPDATE games SET platform = 'manual' WHERE platform IS NULL"))
    conn.execute(sa.text("ALTER TABLE games ALTER COLUMN platform SET NOT NULL"))

    # Drop achievement_platform_ids
    conn.execute(sa.text("DROP TABLE IF EXISTS achievement_platform_ids"))

    # Drop trophy_sets.platform
    conn.execute(sa.text("ALTER TABLE trophy_sets DROP COLUMN IF EXISTS platform"))
