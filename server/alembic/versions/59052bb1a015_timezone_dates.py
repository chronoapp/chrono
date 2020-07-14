"""timezone dates

Revision ID: 59052bb1a015
Revises: 36de042aa414
Create Date: 2020-07-14 05:03:42.821898

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '59052bb1a015'
down_revision = '36de042aa414'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('event', sa.Column('end', sa.DateTime(timezone=True), nullable=True))
    op.add_column('event', sa.Column('start', sa.DateTime(timezone=True), nullable=True))
    op.add_column('event', sa.Column('time_zone', sa.String(length=255), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('event', 'time_zone')
    op.drop_column('event', 'start')
    op.drop_column('event', 'end')
    # ### end Alembic commands ###
