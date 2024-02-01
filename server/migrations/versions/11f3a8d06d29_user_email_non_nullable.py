"""user.email non nullable

Revision ID: 11f3a8d06d29
Revises: 48081ab1beb4
Create Date: 2024-02-01 05:46:14.920864

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '11f3a8d06d29'
down_revision = '48081ab1beb4'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('user', 'email', existing_type=sa.VARCHAR(length=255), nullable=False)


def downgrade():
    op.alter_column('user', 'email', existing_type=sa.VARCHAR(length=255), nullable=True)
