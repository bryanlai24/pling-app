"""add parent_objective_id to objectives

Revision ID: c4e1f7b2a903
Revises: b3f1a2c8d901
Create Date: 2026-05-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'c4e1f7b2a903'
down_revision = 'b3f1a2c8d901'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'objectives',
        sa.Column(
            'parent_objective_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('objectives.id', ondelete='CASCADE'),
            nullable=True,
        )
    )
    op.create_index(
        'ix_objectives_parent_objective_id',
        'objectives',
        ['parent_objective_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_objectives_parent_objective_id', table_name='objectives')
    op.drop_column('objectives', 'parent_objective_id')
