"""add ACL

Revision ID: 3aab103d796f
Revises: 9c19062303cc
Create Date: 2022-06-29 17:18:03.908830

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '3aab103d796f'
down_revision = '9c19062303cc'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'access_control_rule',
        sa.Column('uuid', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('google_id', sa.String(), nullable=True),
        sa.Column('calendar_id', sa.String(), nullable=True),
        sa.Column('role', sa.String(length=50), nullable=True),
        sa.Column('scope_type', sa.String(length=50), nullable=True),
        sa.Column('scope_value', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ['calendar_id'],
            ['calendar.id'],
        ),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index(
        op.f('ix_access_control_rule_google_id'), 'access_control_rule', ['google_id'], unique=False
    )


def downgrade():
    op.drop_index(op.f('ix_access_control_rule_google_id'), table_name='access_control_rule')
    op.drop_table('access_control_rule')
