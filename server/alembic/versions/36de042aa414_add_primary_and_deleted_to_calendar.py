"""add primary and deleted to calendar

Revision ID: 36de042aa414
Revises: a4bfb0272299
Create Date: 2020-07-10 02:29:48.049697

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '36de042aa414'
down_revision = 'a4bfb0272299'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('calendar', sa.Column('deleted', sa.Boolean(), nullable=True))
    op.add_column('calendar', sa.Column('primary', sa.Boolean(), nullable=True))
    op.create_unique_constraint(None, 'calendar', ['id'])
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(None, 'calendar', type_='unique')
    op.drop_column('calendar', 'primary')
    op.drop_column('calendar', 'deleted')
    # ### end Alembic commands ###