"""add event permissions

Revision ID: 9c19062303cc
Revises: 8a932b6aa021
Create Date: 2022-06-28 15:35:30.227235

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9c19062303cc'
down_revision = '8a932b6aa021'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'event',
        sa.Column('guests_can_invite_others', sa.Boolean(), server_default='1', nullable=False),
    )
    op.add_column(
        'event', sa.Column('guests_can_modify', sa.Boolean(), server_default='0', nullable=False)
    )
    op.add_column(
        'event',
        sa.Column('guests_can_see_other_guests', sa.Boolean(), server_default='1', nullable=False),
    )


def downgrade():
    op.drop_column('event', 'guests_can_see_other_guests')
    op.drop_column('event', 'guests_can_modify')
    op.drop_column('event', 'guests_can_invite_others')
