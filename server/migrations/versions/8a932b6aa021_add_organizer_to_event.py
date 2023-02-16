"""add organizer to event

Revision ID: 8a932b6aa021
Revises: 4338ced04a1d
Create Date: 2022-06-28 14:21:04.808876

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8a932b6aa021'
down_revision = '4338ced04a1d'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('event', sa.Column('organizer_id', sa.String(length=255), nullable=True))
    op.create_foreign_key(
        'event_organizer_fk', 'event', 'event_participant', ['organizer_id'], ['id'], use_alter=True
    )
    op.create_foreign_key(
        'event_creator_fk', 'event', 'event_participant', ['creator_id'], ['id'], use_alter=True
    )


def downgrade():
    op.drop_constraint('event_creator_fk', 'event', type_='foreignkey')
    op.drop_constraint('event_organizer_fk', 'event', type_='foreignkey')
    op.drop_column('event', 'organizer_id')
