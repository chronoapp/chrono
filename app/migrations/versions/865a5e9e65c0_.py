"""empty message

Revision ID: 865a5e9e65c0
Revises: 2828b9085d83
Create Date: 2018-11-05 01:22:44.130229

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '865a5e9e65c0'
down_revision = '2828b9085d83'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('label', sa.Column('key', sa.String(length=50), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('label', 'key')
    # ### end Alembic commands ###