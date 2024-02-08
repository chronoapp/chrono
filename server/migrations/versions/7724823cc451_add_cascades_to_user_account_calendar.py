"""add cascades to user, account, calendar

Revision ID: 7724823cc451
Revises: 5fdcab8cb72d
Create Date: 2024-02-08 22:46:36.791710

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7724823cc451'
down_revision = '5fdcab8cb72d'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('fk_user_default_calendar', 'user', type_='foreignkey')
    op.create_foreign_key(
        'fk_user_default_calendar',
        'user',
        'user_calendar',
        ['default_calendar_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.drop_constraint('fk_user_calendar_account', 'user_calendar', type_='foreignkey')
    op.create_foreign_key(
        'fk_user_calendar_account',
        'user_calendar',
        'user_credentials',
        ['account_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.drop_constraint('user_credentials_user_id_fkey', 'user_credentials', type_='foreignkey')
    op.create_foreign_key(
        'user_credentials_user_id_fkey',
        'user_credentials',
        'user',
        ['user_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade():
    op.drop_constraint('user_credentials_user_id_fkey', 'user_credentials', type_='foreignkey')
    op.create_foreign_key(
        'user_credentials_user_id_fkey', 'user_credentials', 'user', ['user_id'], ['id']
    )
    op.drop_constraint('fk_user_calendar_account', 'user_calendar', type_='foreignkey')
    op.create_foreign_key(
        'fk_user_calendar_account', 'user_calendar', 'user_credentials', ['account_id'], ['id']
    )
    op.drop_constraint('fk_user_default_calendar', 'user', type_='foreignkey')
    op.create_foreign_key(
        'fk_user_default_calendar',
        'user',
        'user_calendar',
        ['default_calendar_id'],
        ['id'],
        ondelete='SET NULL',
    )
