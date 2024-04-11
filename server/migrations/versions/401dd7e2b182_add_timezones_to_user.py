"""add timezones to user

Revision ID: 401dd7e2b182
Revises: bc9ab5a079f1
Create Date: 2024-04-11 20:00:54.640273

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '401dd7e2b182'
down_revision = 'bc9ab5a079f1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user', sa.Column('timezones', sa.ARRAY(sa.String()), nullable=True))


def downgrade():
    op.drop_column('user', 'timezones')
