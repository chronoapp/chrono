"""create index on event

Revision ID: 77f86399d60f
Revises: 02bc2d4fbef7
Create Date: 2019-03-24 06:52:51.613724

"""
from alembic import op
import logging
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '77f86399d60f'
down_revision = '02bc2d4fbef7'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()

    connection.execute("""
        CREATE INDEX idx_fts_event ON event
            USING gin((setweight(to_tsvector('english', title), 'A') ||
                setweight(to_tsvector('english', coalesce(description, '')), 'B')));
    """)


def downgrade():
    connection = op.get_bind()

    connection.execute("""
        DROP INDEX idx_fts_event;
    """)
