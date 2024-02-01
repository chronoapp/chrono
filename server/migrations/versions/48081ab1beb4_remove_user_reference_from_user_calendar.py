"""remove user reference from user_calendar

Revision ID: 48081ab1beb4
Revises: be1dec2eba9f
Create Date: 2024-02-01 05:42:45.273952

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '48081ab1beb4'
down_revision = 'be1dec2eba9f'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('user_calendar_user_id_fkey', 'user_calendar', type_='foreignkey')
    op.drop_column('user_calendar', 'user_id')


def downgrade():
    op.add_column(
        'user_calendar', sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=True)
    )
    op.create_foreign_key(
        'user_calendar_user_id_fkey', 'user_calendar', 'user', ['user_id'], ['id']
    )
