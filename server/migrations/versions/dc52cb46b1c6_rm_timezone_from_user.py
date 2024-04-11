"""rm timezone from user

Revision ID: dc52cb46b1c6
Revises: 401dd7e2b182
Create Date: 2024-04-11 20:49:33.785045

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'dc52cb46b1c6'
down_revision = '401dd7e2b182'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('user', 'timezone')


def downgrade():
    op.add_column(
        'user',
        sa.Column(
            'timezone',
            sa.VARCHAR(length=255),
            server_default=sa.text("'UTC'::character varying"),
            autoincrement=False,
            nullable=False,
        ),
    )
