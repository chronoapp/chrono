"""index google id

Revision ID: 778726ef5e7f
Revises: ca495e48f2c5
Create Date: 2023-02-22 02:46:24.256718

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '778726ef5e7f'
down_revision = 'ca495e48f2c5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(op.f('ix_calendar_google_id'), 'calendar', ['google_id'], unique=False)
    op.create_foreign_key(
        'event_creator_fk', 'event', 'event_participant', ['creator_id'], ['id'], use_alter=True
    )
    op.create_foreign_key(
        'event_organizer_fk', 'event', 'event_participant', ['organizer_id'], ['id'], use_alter=True
    )
    op.create_index(
        op.f('ix_user_calendar_google_id'), 'user_calendar', ['google_id'], unique=False
    )


def downgrade():
    op.drop_index(op.f('ix_user_calendar_google_id'), table_name='user_calendar')
    op.drop_constraint('event_organizer_fk', 'event', type_='foreignkey')
    op.drop_constraint('event_creator_fk', 'event', type_='foreignkey')
    op.drop_index(op.f('ix_calendar_google_id'), table_name='calendar')
