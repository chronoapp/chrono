"""add email to user creds

Revision ID: cff72251c08c
Revises: f44323dbeb83
Create Date: 2024-01-26 05:55:05.658659

"""
from alembic import op
import sqlalchemy as sa

from app.db.session import scoped_session
from app.db.models import UserCredential

# revision identifiers, used by Alembic.
revision = 'cff72251c08c'
down_revision = 'f44323dbeb83'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user_credentials', sa.Column('email', sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column('user_credentials', 'email')
