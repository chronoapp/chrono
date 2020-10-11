"""add provider to usercreds

Revision ID: c85ac05cee03
Revises: b1a4af9c084c
Create Date: 2020-10-11 02:52:03.430033

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c85ac05cee03'
down_revision = 'b1a4af9c084c'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    providerType = postgresql.ENUM('google', 'microsoft', name='providertype')
    providerType.create(op.get_bind())

    op.add_column('user_credentials', sa.Column('expires_at', sa.DateTime(), nullable=True))
    op.add_column(
        'user_credentials',
        sa.Column('provider',
                  postgresql.ENUM('google', 'microsoft', name='providertype'),
                  server_default='google',
                  nullable=False))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('user_credentials', 'provider')
    op.drop_column('user_credentials', 'expires_at')
    providerType = postgresql.ENUM('google', 'microsoft', name='providertype')
    providerType.drop(op.get_bind())
    # ### end Alembic commands ###
