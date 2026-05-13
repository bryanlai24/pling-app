"""add sort_order to achievements

Revision ID: 6160e1569978
Revises: 6c2df5630d86
Create Date: 2026-05-12 06:20:59.622273

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '6160e1569978'
down_revision: Union[str, None] = '6c2df5630d86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('achievements', sa.Column('sort_order', sa.Integer(), nullable=True))
    op.execute("UPDATE achievements SET sort_order = 0 WHERE sort_order IS NULL")
    op.alter_column('achievements', 'sort_order', nullable=False)


def downgrade() -> None:
    op.drop_column('achievements', 'sort_order')
