"""add account ID to calendar

Revision ID: be1dec2eba9f
Revises: 8043039b1e93
Create Date: 2024-01-26 22:59:58.450804

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'be1dec2eba9f'
down_revision = '8043039b1e93'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user_calendar', sa.Column('account_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_user_calendar_account', 'user_calendar', 'user_credentials', ['account_id'], ['id']
    )


def downgrade():
    op.drop_constraint('fk_user_calendar_account', 'user_calendar', type_='foreignkey')
    op.drop_column('user_calendar', 'account_id')
