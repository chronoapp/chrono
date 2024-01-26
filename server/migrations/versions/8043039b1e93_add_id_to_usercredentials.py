"""add id to usercredentials

Revision ID: 8043039b1e93
Revises: 95111f68d87c
Create Date: 2024-01-26 08:21:43.676699

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '8043039b1e93'
down_revision = '95111f68d87c'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""))

    op.add_column(
        'user_credentials',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('uuid_generate_v4()')),
    )
    op.execute('ALTER TABLE user_credentials DROP CONSTRAINT IF EXISTS user_credentials_pkey')
    op.create_primary_key('pk_user_credentials', 'user_credentials', ['id'])


def downgrade():
    op.drop_column('user_credentials', 'id')
