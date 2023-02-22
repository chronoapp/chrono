"""rm unique calendar google id

Revision ID: ca495e48f2c5
Revises: 8f1bf3908324
Create Date: 2023-02-22 01:25:36.688494

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ca495e48f2c5'
down_revision = '8f1bf3908324'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('user_calendar_google_id_fkey', 'user_calendar', type_='foreignkey')
    op.drop_constraint('calendar_google_id_key', 'calendar', type_='unique')


def downgrade():
    op.create_foreign_key(
        'user_calendar_google_id_fkey', 'user_calendar', 'calendar', ['google_id'], ['google_id']
    )
    op.create_unique_constraint('calendar_google_id_key', 'calendar', ['google_id'])
