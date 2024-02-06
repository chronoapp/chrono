"""add user default calendar

Revision ID: 5fdcab8cb72d
Revises: fc8fe8a0c2f7
Create Date: 2024-02-06 21:04:46.559355

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5fdcab8cb72d'
down_revision = 'fc8fe8a0c2f7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user', sa.Column('default_calendar_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_user_default_calendar', 'user', 'user_calendar', ['default_calendar_id'], ['id']
    )


def downgrade():
    op.drop_constraint('fk_user_default_calendar', 'user', type_='foreignkey')
    op.drop_column('user', 'default_calendar_id')
