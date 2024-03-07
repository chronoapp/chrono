"""add extended properties to event

Revision ID: bc9ab5a079f1
Revises: 8295e9c9c307
Create Date: 2024-03-01 21:50:37.707086

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'bc9ab5a079f1'
down_revision = '8295e9c9c307'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'event',
        sa.Column('extended_properties', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade():
    op.drop_column('event', 'extended_properties')
