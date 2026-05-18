"""add psn_npsso to users

Revision ID: d7e3f9a1b205
Revises: c4e1f7b2a903
Create Date: 2026-05-17

"""
from alembic import op
import sqlalchemy as sa

revision = 'd7e3f9a1b205'
down_revision = 'c4e1f7b2a903'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('psn_npsso', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'psn_npsso')
