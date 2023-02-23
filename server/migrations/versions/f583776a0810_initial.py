"""initial

Revision ID: f583776a0810
Revises: 
Create Date: 2023-02-23 07:51:04.443019

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f583776a0810'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'calendar',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('google_id', sa.String(length=255), nullable=True),
        sa.Column('summary', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('timezone', sa.String(length=255), nullable=True),
        sa.Column('email_', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_calendar_google_id'), 'calendar', ['google_id'], unique=False)
    op.create_table(
        'user',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('picture_url', sa.String(length=255), nullable=True),
        sa.Column('google_oauth_state', sa.String(length=255), nullable=True),
        sa.Column('timezone', sa.String(length=255), server_default='UTC', nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'access_control_rule',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('google_id', sa.String(), nullable=True),
        sa.Column('calendar_id', sa.UUID(), nullable=True),
        sa.Column('role', sa.String(length=50), nullable=True),
        sa.Column('scope_type', sa.String(length=50), nullable=True),
        sa.Column('scope_value', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ['calendar_id'],
            ['calendar.id'],
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_access_control_rule_google_id'), 'access_control_rule', ['google_id'], unique=False
    )
    op.create_table(
        'contact',
        sa.Column('id', sa.String(length=255), nullable=False),
        sa.Column('google_id', sa.String(length=255), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('first_name', sa.String(length=255), nullable=True),
        sa.Column('last_name', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('photo_url', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['user.id'],
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('google_id'),
    )
    op.create_index(op.f('ix_contact_email'), 'contact', ['email'], unique=False)
    op.create_table(
        'event',
        sa.Column('uid', sa.UUID(), nullable=False),
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('google_id', sa.String(length=255), nullable=True),
        sa.Column('calendar_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
        sa.Column('start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('start_day', sa.String(length=10), nullable=True),
        sa.Column('end_day', sa.String(length=10), nullable=True),
        sa.Column('time_zone', sa.String(length=255), nullable=True),
        sa.Column('creator_id', sa.String(length=255), nullable=True),
        sa.Column('organizer_id', sa.String(length=255), nullable=True),
        sa.Column('recurrences', sa.ARRAY(sa.String()), nullable=True),
        sa.Column('recurring_event_id', sa.String(), nullable=True),
        sa.Column('recurring_event_calendar_id', sa.UUID(), nullable=True),
        sa.Column('original_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('original_start_day', sa.String(length=10), nullable=True),
        sa.Column('original_timezone', sa.String(length=255), nullable=True),
        sa.Column('guests_can_modify', sa.Boolean(), nullable=False),
        sa.Column('guests_can_invite_others', sa.Boolean(), nullable=False),
        sa.Column('guests_can_see_other_guests', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['calendar_id'], ['calendar.id'], name='event_calendar_id_fk'),
        sa.ForeignKeyConstraint(
            ['creator_id'], ['event_participant.id'], name='event_creator_fk', use_alter=True
        ),
        sa.ForeignKeyConstraint(
            ['organizer_id'], ['event_participant.id'], name='event_organizer_fk', use_alter=True
        ),
        sa.ForeignKeyConstraint(
            ['recurring_event_id', 'recurring_event_calendar_id'],
            ['event.id', 'event.calendar_id'],
            name='fk_recurring_event_id_calendar_id',
        ),
        sa.PrimaryKeyConstraint('uid'),
        sa.UniqueConstraint('id', 'calendar_id', name='uix_calendar_event_id'),
    )
    op.create_index(op.f('ix_event_google_id'), 'event', ['google_id'], unique=False)
    op.create_index(op.f('ix_event_id'), 'event', ['id'], unique=False)
    op.create_index(
        op.f('ix_event_recurring_event_calendar_id'),
        'event',
        ['recurring_event_calendar_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_event_recurring_event_id'), 'event', ['recurring_event_id'], unique=False
    )
    op.create_index(op.f('ix_event_title'), 'event', ['title'], unique=False)
    op.create_table(
        'label',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('parent_id', sa.BigInteger(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('key', sa.String(length=50), nullable=True),
        sa.Column('color_hex', sa.String(length=50), nullable=False),
        sa.Column('position', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ['parent_id'],
            ['label.id'],
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['user.id'],
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_label_key'), 'label', ['key'], unique=False)
    op.create_table(
        'user_calendar',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('google_id', sa.String(length=255), nullable=True),
        sa.Column('sync_token', sa.String(length=255), nullable=True),
        sa.Column('summary_override', sa.String(length=255), nullable=True),
        sa.Column('background_color', sa.String(length=10), nullable=True),
        sa.Column('foreground_color', sa.String(length=10), nullable=True),
        sa.Column('selected', sa.Boolean(), nullable=False),
        sa.Column('access_role', sa.String(length=50), nullable=True),
        sa.Column('primary', sa.Boolean(), nullable=True),
        sa.Column('deleted', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(
            ['id'],
            ['calendar.id'],
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['user.id'],
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_user_calendar_google_id'), 'user_calendar', ['google_id'], unique=False
    )
    op.create_table(
        'user_credentials',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=30), nullable=False),
        sa.Column('token_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['user.id'],
        ),
        sa.PrimaryKeyConstraint('user_id', 'provider'),
    )
    op.create_table(
        'event_label',
        sa.Column('event_uid', sa.UUID(), nullable=True),
        sa.Column('label_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['event_uid'], ['event.uid'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['label_id'], ['label.id'], ondelete='CASCADE'),
    )
    op.create_table(
        'event_participant',
        sa.Column('id', sa.String(length=255), nullable=False),
        sa.Column('event_uid', sa.UUID(), nullable=True),
        sa.Column('email_', sa.String(length=255), nullable=True),
        sa.Column('display_name_', sa.String(length=255), nullable=True),
        sa.Column('contact_id', sa.String(length=255), nullable=True),
        sa.Column('response_status', sa.String(length=255), nullable=True),
        sa.Column('type_', sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(
            ['contact_id'],
            ['contact.id'],
        ),
        sa.ForeignKeyConstraint(
            ['event_uid'],
            ['event.uid'],
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_event_participant_email_'), 'event_participant', ['email_'], unique=False
    )
    op.create_table(
        'label_rule',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('text', sa.String(length=255), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('label_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ['label_id'],
            ['label.id'],
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['user.id'],
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'webhook',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('calendar_id', sa.UUID(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('resource_uri', sa.String(), nullable=True),
        sa.Column('expiration', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ['calendar_id'],
            ['user_calendar.id'],
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('webhook')
    op.drop_table('label_rule')
    op.drop_index(op.f('ix_event_participant_email_'), table_name='event_participant')
    op.drop_table('event_participant')
    op.drop_table('event_label')
    op.drop_table('user_credentials')
    op.drop_index(op.f('ix_user_calendar_google_id'), table_name='user_calendar')
    op.drop_table('user_calendar')
    op.drop_index(op.f('ix_label_key'), table_name='label')
    op.drop_table('label')
    op.drop_index(op.f('ix_event_title'), table_name='event')
    op.drop_index(op.f('ix_event_recurring_event_id'), table_name='event')
    op.drop_index(op.f('ix_event_recurring_event_calendar_id'), table_name='event')
    op.drop_index(op.f('ix_event_id'), table_name='event')
    op.drop_index(op.f('ix_event_google_id'), table_name='event')
    op.drop_table('event')
    op.drop_index(op.f('ix_contact_email'), table_name='contact')
    op.drop_table('contact')
    op.drop_index(op.f('ix_access_control_rule_google_id'), table_name='access_control_rule')
    op.drop_table('access_control_rule')
    op.drop_table('user')
    op.drop_index(op.f('ix_calendar_google_id'), table_name='calendar')
    op.drop_table('calendar')
