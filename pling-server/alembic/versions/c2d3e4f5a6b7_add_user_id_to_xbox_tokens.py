"""add user_id to xbox_tokens for per-user sync

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'c2d3e4f5a6b7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add nullable user_id FK — existing server-wide token row stays valid (user_id=NULL)
    op.add_column(
        'xbox_tokens',
        sa.Column('user_id', UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_xbox_tokens_user_id',
        'xbox_tokens', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE',
    )
    op.create_index('ix_xbox_tokens_user_id', 'xbox_tokens', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_xbox_tokens_user_id', table_name='xbox_tokens')
    op.drop_constraint('fk_xbox_tokens_user_id', 'xbox_tokens', type_='foreignkey')
    op.drop_column('xbox_tokens', 'user_id')
