"""add updated date to event

Revision ID: 6bccb069711e
Revises: 279656e0e4af
Create Date: 2024-02-01 22:56:05.886170

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6bccb069711e'
down_revision = '279656e0e4af'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'event',
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column('event', 'updated_at')
