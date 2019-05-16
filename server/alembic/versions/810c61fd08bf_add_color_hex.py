"""add color hex

Revision ID: 810c61fd08bf
Revises: d60058ebf845
Create Date: 2019-05-16 08:51:53.864465

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '810c61fd08bf'
down_revision = 'd60058ebf845'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('label', sa.Column('color_hex', sa.String(length=50),
        nullable=False, server_default='f5f5f5'))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('label', 'color_hex')
    # ### end Alembic commands ###
