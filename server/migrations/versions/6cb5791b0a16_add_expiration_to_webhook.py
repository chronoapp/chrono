"""add expiration to webhook

Revision ID: 6cb5791b0a16
Revises: 093305c1729e
Create Date: 2022-08-26 09:06:01.520353

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6cb5791b0a16'
down_revision = '093305c1729e'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'webhook',
        sa.Column(
            'expiration',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
    )


def downgrade():
    op.drop_column('webhook', 'expiration')
