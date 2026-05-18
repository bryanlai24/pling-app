"""add image_url and video_url to objectives

Revision ID: f1a2b3c4d5e6
Revises: e8b2c4d6f901
Create Date: 2026-05-18

"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = 'e8b2c4d6f901'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('objectives', sa.Column('image_url', sa.String(500), nullable=True))
    op.add_column('objectives', sa.Column('video_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('objectives', 'video_url')
    op.drop_column('objectives', 'image_url')
