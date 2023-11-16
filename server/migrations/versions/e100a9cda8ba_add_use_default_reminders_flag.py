"""add use default reminders flag

Revision ID: e100a9cda8ba
Revises: 88dab2a83495
Create Date: 2023-08-24 02:55:14.364967

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e100a9cda8ba'
down_revision = '88dab2a83495'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'event',
        sa.Column('use_default_reminders', sa.Boolean(), nullable=False, server_default='true'),
    )


def downgrade():
    op.drop_column('event', 'use_default_reminders')
