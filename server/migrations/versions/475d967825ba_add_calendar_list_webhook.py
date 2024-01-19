"""Add calendar list webhook

Revision ID: 475d967825ba
Revises: 296218927a33
Create Date: 2024-01-19 21:33:21.595044

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '475d967825ba'
down_revision = '296218927a33'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('webhook', sa.Column('user_id', sa.UUID(), nullable=False))
    op.add_column('webhook', sa.Column('type', sa.String(), nullable=False))
    op.create_foreign_key('fk_webhook_user', 'webhook', 'user', ['user_id'], ['id'])
    op.alter_column('webhook', 'calendar_id', nullable=True)


def downgrade():
    op.alter_column('webhook', 'calendar_id', nullable=False)
    op.drop_constraint('fk_webhook_user', 'webhook', type_='foreignkey')
    op.drop_column('webhook', 'type')
    op.drop_column('webhook', 'user_id')
