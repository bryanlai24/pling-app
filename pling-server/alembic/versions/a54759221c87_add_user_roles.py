"""add user roles

Revision ID: a54759221c87
Revises: 986daa9286ab
Create Date: 2026-04-27 23:02:25.900520

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a54759221c87'
down_revision: Union[str, None] = '986daa9286ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the enum type first
    op.execute("CREATE TYPE user_role_enum AS ENUM ('user', 'contributor', 'admin')")
    
    op.add_column('users', sa.Column('role', sa.Enum('user', 'contributor', 'admin', name='user_role_enum'), server_default='user', nullable=False))
    op.alter_column('users', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               existing_nullable=False)
    op.alter_column('users', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               existing_nullable=False)


def downgrade() -> None:
    op.alter_column('users', 'updated_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False)
    op.alter_column('users', 'created_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False)
    op.drop_column('users', 'role')
    
    # Drop the enum type after dropping the column
    op.execute("DROP TYPE user_role_enum")
