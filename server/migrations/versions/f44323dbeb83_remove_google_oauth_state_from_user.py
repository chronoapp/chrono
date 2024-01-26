"""remove google_oauth_state from user

Revision ID: f44323dbeb83
Revises: 475d967825ba
Create Date: 2024-01-26 05:35:48.032186

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f44323dbeb83'
down_revision = '475d967825ba'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('user', 'google_oauth_state')


def downgrade():
    op.add_column(
        'user',
        sa.Column('google_oauth_state', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
    )
