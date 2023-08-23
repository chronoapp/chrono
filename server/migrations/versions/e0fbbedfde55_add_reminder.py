"""add reminder

Revision ID: e0fbbedfde55
Revises: d47952683ac1
Create Date: 2023-08-23 19:56:40.897310

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e0fbbedfde55'
down_revision = 'd47952683ac1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'reminder_override',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('event_uid', sa.UUID(), nullable=True),
        sa.Column('user_calendar_id', sa.UUID(), nullable=True),
        sa.Column(
            'method', sa.Enum('EMAIL', 'POPUP', 'SMS', name='reminder_method'), nullable=False
        ),
        sa.Column('minutes', sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(
            ['event_uid'],
            ['event.uid'],
        ),
        sa.ForeignKeyConstraint(
            ['user_calendar_id'],
            ['user_calendar.id'],
        ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('reminder_override')
    op.execute('DROP TYPE reminder_method')
