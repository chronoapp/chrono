"""add zoom integration to user

Revision ID: b8b01aa085fb
Revises: 7724823cc451
Create Date: 2024-02-13 22:44:41.288960

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b8b01aa085fb'
down_revision = '7724823cc451'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'zoom_connection',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('refresh_token', sa.Text(), nullable=False),
        sa.Column('access_token', sa.Text(), nullable=False),
        sa.Column('scope', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(
            ['user_id'], ['user.id'], name='fk_zoom_user_id', ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('zoom_connection')
