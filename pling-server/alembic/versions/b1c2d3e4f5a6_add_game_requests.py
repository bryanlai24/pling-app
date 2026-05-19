"""add game requests and votes tables

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-05-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'b1c2d3e4f5a6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL throughout to avoid SQLAlchemy DDL events firing CREATE TYPE
    # automatically (which breaks when the type already exists from init_db).
    conn = op.get_bind()

    exists = conn.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname = 'request_status_enum'"
    )).scalar()
    if not exists:
        conn.execute(sa.text(
            "CREATE TYPE request_status_enum AS ENUM ('open', 'fulfilled')"
        ))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS game_requests (
            id          UUID PRIMARY KEY,
            title       VARCHAR(255) NOT NULL,
            platform    VARCHAR(50),
            notes       VARCHAR(500),
            status      request_status_enum NOT NULL DEFAULT 'open',
            requested_by_id  UUID REFERENCES users(id) ON DELETE SET NULL,
            fulfilled_game_id UUID REFERENCES games(id) ON DELETE SET NULL,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )
    """))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS game_request_votes (
            id         UUID PRIMARY KEY,
            request_id UUID NOT NULL REFERENCES game_requests(id) ON DELETE CASCADE,
            user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_game_request_vote UNIQUE (request_id, user_id)
        )
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS game_request_votes"))
    conn.execute(sa.text("DROP TABLE IF EXISTS game_requests"))
    conn.execute(sa.text("DROP TYPE IF EXISTS request_status_enum"))
