"""index calendar id in ACL

Revision ID: 296218927a33
Revises: e100a9cda8ba
Create Date: 2024-01-18 21:20:50.902250

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '296218927a33'
down_revision = 'e100a9cda8ba'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        op.f('ix_access_control_rule_calendar_id'),
        'access_control_rule',
        ['calendar_id'],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f('ix_access_control_rule_calendar_id'), table_name='access_control_rule')
