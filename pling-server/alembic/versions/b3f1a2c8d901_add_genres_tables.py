"""add genres tables

Revision ID: b3f1a2c8d901
Revises: 1166c332f1d4
Create Date: 2026-05-16 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b3f1a2c8d901'
down_revision: Union[str, None] = '1166c332f1d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the enum type if it doesn't already exist (may have been created by init_db)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE base_genre_enum AS ENUM (
                'action', 'adventure', 'rpg', 'strategy', 'simulation',
                'sports', 'racing', 'puzzle', 'horror', 'platformer',
                'fighting', 'shooter', 'mmorpg', 'rhythm'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # Create genres table
    op.create_table(
        'genres',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column(
            'genre',
            postgresql.ENUM(
                'action', 'adventure', 'rpg', 'strategy', 'simulation',
                'sports', 'racing', 'puzzle', 'horror', 'platformer',
                'fighting', 'shooter', 'mmorpg', 'rhythm',
                name='base_genre_enum',
                create_type=False,
            ),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('genre'),
    )

    # Create game_genres join table
    op.create_table(
        'game_genres',
        sa.Column('game_id', sa.UUID(), nullable=False),
        sa.Column('genre_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['game_id'], ['games.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['genre_id'], ['genres.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('game_id', 'genre_id'),
    )

    # Drop the old genre string column from games
    op.drop_column('games', 'genre')


def downgrade() -> None:
    # Re-add the old genre column
    op.add_column('games', sa.Column('genre', sa.String(length=100), nullable=True))

    # Drop join table and genres table
    op.drop_table('game_genres')
    op.drop_table('genres')
    op.execute("DROP TYPE IF EXISTS base_genre_enum")
