"""cascade

Revision ID: a38f7f332e15
Revises: d4fdf3d510c8
Create Date: 2021-03-11 12:48:42.494307

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a38f7f332e15'
down_revision = 'd4fdf3d510c8'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint('event_label_event_id_fkey', 'event_label', type_='foreignkey')
    op.drop_constraint('event_label_label_id_fkey', 'event_label', type_='foreignkey')
    op.create_foreign_key(
        'event_label_event_id_fkey',
        'event_label',
        'event',
        ['event_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_foreign_key(
        'event_label_label_id_fkey',
        'event_label',
        'label',
        ['label_id'],
        ['id'],
        ondelete='CASCADE',
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint('event_label_event_id_fkey', 'event_label', type_='foreignkey')
    op.drop_constraint('event_label_label_id_fkey', 'event_label', type_='foreignkey')
    op.create_foreign_key('event_label_label_id_fkey', 'event_label', 'label', ['label_id'], ['id'])
    op.create_foreign_key('event_label_event_id_fkey', 'event_label', 'event', ['event_id'], ['id'])
    # ### end Alembic commands ###