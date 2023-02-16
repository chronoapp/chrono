"""add event participant type

Revision ID: 7a1b06c4cc03
Revises: 3aab103d796f
Create Date: 2022-06-29 17:26:13.897759

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7a1b06c4cc03'
down_revision = '3aab103d796f'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('event_participant', sa.Column('type_', sa.String(length=20), nullable=False))


def downgrade():
    op.drop_column('event_participant', 'type_')
