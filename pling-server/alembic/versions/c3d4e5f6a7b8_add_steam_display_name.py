"""Add steam_display_name to users

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-19
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.get_bind().execute(sa.text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_display_name VARCHAR(100) NULL"
    ))


def downgrade() -> None:
    op.get_bind().execute(sa.text(
        "ALTER TABLE users DROP COLUMN IF EXISTS steam_display_name"
    ))
