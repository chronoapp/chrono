"""add is_default to credentials

Revision ID: 95111f68d87c
Revises: cff72251c08c
Create Date: 2024-01-26 07:01:00.488162

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '95111f68d87c'
down_revision = 'cff72251c08c'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'user_credentials',
        sa.Column('is_default', sa.Boolean(), server_default='true', nullable=False),
    )


def downgrade():
    op.drop_column('user_credentials', 'is_default')
