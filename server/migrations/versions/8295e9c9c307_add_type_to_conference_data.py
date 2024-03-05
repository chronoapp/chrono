"""add type to conference data

Revision ID: 8295e9c9c307
Revises: b8b01aa085fb
Create Date: 2024-02-28 22:26:11.604109

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '8295e9c9c307'
down_revision = 'b8b01aa085fb'
branch_labels = None
depends_on = None

# Define the enum type
chronoconferencetype_enum = postgresql.ENUM('Google', 'Zoom', name='chronoconferencetype')


def upgrade():
    # Create the enum type
    chronoconferencetype_enum.create(op.get_bind(), checkfirst=True)

    # Add the column
    op.add_column(
        'conference_data',
        sa.Column('type', chronoconferencetype_enum, nullable=False, server_default='Google'),
    )


def downgrade():
    # Remove the column
    op.drop_column('conference_data', 'type')

    # Drop the enum type
    chronoconferencetype_enum.drop(op.get_bind(), checkfirst=True)
