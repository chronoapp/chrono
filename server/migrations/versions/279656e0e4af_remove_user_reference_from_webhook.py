"""remove user reference from webhook

Revision ID: 279656e0e4af
Revises: 3ff7df5c215e
Create Date: 2024-02-01 06:49:52.792694

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '279656e0e4af'
down_revision = '3ff7df5c215e'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('fk_webhook_user', 'webhook', type_='foreignkey')
    op.drop_column('webhook', 'user_id')


def downgrade():
    op.add_column('webhook', sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False))
    op.create_foreign_key('fk_webhook_user', 'webhook', 'user', ['user_id'], ['id'])
