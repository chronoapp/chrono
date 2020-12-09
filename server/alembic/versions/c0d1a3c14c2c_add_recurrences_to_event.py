"""add recurrences to event

Revision ID: c0d1a3c14c2c
Revises: eb8a9fb3e518
Create Date: 2020-12-02 14:13:09.959850

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c0d1a3c14c2c'
down_revision = 'eb8a9fb3e518'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('event', sa.Column('recurrences', sa.ARRAY(sa.String()), nullable=True))
    op.add_column('event', sa.Column('recurring_event_id', sa.BigInteger(), nullable=True))
    op.create_foreign_key(None, 'event', 'event', ['recurring_event_id'], ['id'])
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(None, 'event', type_='foreignkey')
    op.drop_column('event', 'recurring_event_id')
    op.drop_column('event', 'recurrences')
    # ### end Alembic commands ###
