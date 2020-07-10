"""add calendar

Revision ID: a4bfb0272299
Revises: ff74609313e9
Create Date: 2020-07-10 02:12:12.669016

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a4bfb0272299'
down_revision = 'ff74609313e9'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('calendar', sa.Column('user_id', sa.Integer(), nullable=False),
                    sa.Column('id', sa.String(length=255), nullable=False),
                    sa.Column('timezone', sa.String(length=255), nullable=True),
                    sa.Column('summary', sa.String(length=255), nullable=True),
                    sa.Column('description', sa.Text(), nullable=True),
                    sa.Column('background_color', sa.String(length=10), nullable=True),
                    sa.Column('foreground_color', sa.String(length=10), nullable=True),
                    sa.Column('selected', sa.Boolean(), nullable=True),
                    sa.Column('access_role', sa.String(length=50), nullable=True),
                    sa.ForeignKeyConstraint(
                        ['user_id'],
                        ['user.id'],
                    ), sa.PrimaryKeyConstraint('id'), sa.UniqueConstraint('id'))
    op.add_column('event', sa.Column('calendar_id', sa.String(length=255), nullable=False))
    op.create_foreign_key('event_calendar_fk', 'event', 'calendar', ['calendar_id'], ['id'])
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint('event_calendar_fk', 'event', type_='foreignkey')
    op.drop_column('event', 'calendar_id')
    op.drop_table('calendar')
    # ### end Alembic commands ###
