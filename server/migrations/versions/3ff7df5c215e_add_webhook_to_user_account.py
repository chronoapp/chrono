"""add webhook to user account

Revision ID: 3ff7df5c215e
Revises: 11f3a8d06d29
Create Date: 2024-02-01 06:23:09.530481

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3ff7df5c215e'
down_revision = '11f3a8d06d29'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('webhook', sa.Column('account_id', sa.UUID(), nullable=False))
    op.create_foreign_key(
        'fk_webhook_user_account', 'webhook', 'user_credentials', ['account_id'], ['id']
    )


def downgrade():
    op.drop_constraint('fk_webhook_user_account', 'webhook', type_='foreignkey')
    op.drop_column('webhook', 'account_id')
