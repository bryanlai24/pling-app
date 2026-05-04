"""increase psn token column size

Revision ID: 0d0219d8a35b
Revises: 5bc290fc6c3f
Create Date: 2026-04-30 22:12:50.397150

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '0d0219d8a35b'
down_revision: Union[str, None] = '03647177f394'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
