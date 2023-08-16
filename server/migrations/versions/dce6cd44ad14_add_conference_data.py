"""add conference data

Revision ID: dce6cd44ad14
Revises: 089567d0f920
Create Date: 2023-08-16 23:17:29.982528

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'dce6cd44ad14'
down_revision = '089567d0f920'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'conference_data',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('conference_id', sa.String(), nullable=False),
        sa.Column('event_uid', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(
            ['event_uid'],
            ['event.uid'],
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'conference_solutions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('conference_data_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column(
            'key_type',
            sa.Enum(
                'EVENT_HANGOUT',
                'EVENT_NAMED_HANGOUT',
                'HANGOUTS_MEET',
                'ADD_ON',
                name='conferencekeytype',
            ),
            nullable=False,
        ),
        sa.Column('icon_uri', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ['conference_data_id'],
            ['conference_data.id'],
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'entry_points',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column(
            'entry_point_type',
            sa.Enum('VIDEO', 'PHONE', 'SIP', 'MORE', name='communicationmethod'),
            nullable=False,
        ),
        sa.Column('uri', sa.String(), nullable=False),
        sa.Column('label', sa.String(), nullable=True),
        sa.Column('meeting_code', sa.String(), nullable=True),
        sa.Column('password', sa.String(), nullable=True),
        sa.Column('conference_data_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ['conference_data_id'],
            ['conference_data.id'],
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_foreign_key(
        'event_organizer_fk', 'event', 'event_participant', ['organizer_id'], ['id'], use_alter=True
    )
    op.create_foreign_key(
        'event_creator_fk', 'event', 'event_participant', ['creator_id'], ['id'], use_alter=True
    )


def downgrade():
    op.drop_constraint('event_creator_fk', 'event', type_='foreignkey')
    op.drop_constraint('event_organizer_fk', 'event', type_='foreignkey')
    op.drop_table('entry_points')
    op.drop_table('conference_solutions')
    op.drop_table('conference_data')
    op.execute('DROP TYPE conferencekeytype')
    op.execute('DROP TYPE communicationmethod')
