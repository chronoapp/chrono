"""add account ref to contact

Revision ID: 5d218a7ac1a9
Revises: 6bccb069711e
Create Date: 2024-02-02 08:44:40.460469

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5d218a7ac1a9'
down_revision = '6bccb069711e'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('contact', sa.Column('account_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_contact_user_account', 'contact', 'user_credentials', ['account_id'], ['id']
    )


def downgrade():
    op.drop_constraint('fk_contact_user_account', 'contact', type_='foreignkey')
    op.drop_column('contact', 'account_id')
