"""Add display name to participant

Revision ID: 295771df0e22
Revises: 1c663de078eb
Create Date: 2022-06-15 10:50:26.224712

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '295771df0e22'
down_revision = '1c663de078eb'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'event_participant', sa.Column('display_name_', sa.String(length=255), nullable=True)
    )


def downgrade():
    op.drop_column('event_participant', 'display_name_')
