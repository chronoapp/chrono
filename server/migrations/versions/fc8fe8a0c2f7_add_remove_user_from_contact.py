"""add remove user from contact

Revision ID: fc8fe8a0c2f7
Revises: 5d218a7ac1a9
Create Date: 2024-02-02 09:34:46.439668

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fc8fe8a0c2f7'
down_revision = '5d218a7ac1a9'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('contact', 'account_id', existing_type=sa.UUID(), nullable=False)
    op.drop_constraint('contact_user_id_fkey', 'contact', type_='foreignkey')
    op.drop_column('contact', 'user_id')


def downgrade():
    op.add_column('contact', sa.Column('user_id', sa.UUID(), autoincrement=False, nullable=False))
    op.create_foreign_key('contact_user_id_fkey', 'contact', 'user', ['user_id'], ['id'])
    op.alter_column('contact', 'account_id', existing_type=sa.UUID(), nullable=True)
