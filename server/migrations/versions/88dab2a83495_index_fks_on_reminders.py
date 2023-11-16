"""index fks on reminders

Revision ID: 88dab2a83495
Revises: e0fbbedfde55
Create Date: 2023-08-23 22:12:01.690716

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '88dab2a83495'
down_revision = 'e0fbbedfde55'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        op.f('ix_reminder_override_event_uid'), 'reminder_override', ['event_uid'], unique=False
    )
    op.create_index(
        op.f('ix_reminder_override_user_calendar_id'),
        'reminder_override',
        ['user_calendar_id'],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f('ix_reminder_override_user_calendar_id'), table_name='reminder_override')
    op.drop_index(op.f('ix_reminder_override_event_uid'), table_name='reminder_override')
