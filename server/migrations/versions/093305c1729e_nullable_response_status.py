"""nullable response status

Revision ID: 093305c1729e
Revises: 7a1b06c4cc03
Create Date: 2022-06-29 17:38:10.112846

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '093305c1729e'
down_revision = '7a1b06c4cc03'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'event_participant', 'response_status', existing_type=sa.VARCHAR(length=255), nullable=True
    )


def downgrade():
    op.alter_column(
        'event_participant', 'response_status', existing_type=sa.VARCHAR(length=255), nullable=False
    )
