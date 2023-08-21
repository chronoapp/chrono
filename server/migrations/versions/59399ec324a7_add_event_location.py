"""add event location

Revision ID: 59399ec324a7
Revises: fba0882f35bc
Create Date: 2023-08-21 23:18:35.532149

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '59399ec324a7'
down_revision = 'fba0882f35bc'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('event', sa.Column('location', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('event', 'location')
