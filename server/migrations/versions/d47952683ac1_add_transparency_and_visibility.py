"""add transparency and visibility

Revision ID: d47952683ac1
Revises: 59399ec324a7
Create Date: 2023-08-23 02:02:19.922763

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'd47952683ac1'
down_revision = '59399ec324a7'
branch_labels = None
depends_on = None

transparency_enum = postgresql.ENUM(
    'OPAQUE', 'TRANSPARENT', name='transparency_enum', create_type=True
)
visibility_enum = postgresql.ENUM(
    'DEFAULT', 'PUBLIC', 'PRIVATE', 'CONFIDENTIAL', name='visibility_enum', create_type=True
)


def upgrade():
    transparency_enum.create(op.get_bind())
    visibility_enum.create(op.get_bind())

    op.add_column(
        'event',
        sa.Column(
            'transparency',
            transparency_enum,
            nullable=False,
            server_default='OPAQUE',
        ),
    )
    op.add_column(
        'event',
        sa.Column(
            'visibility',
            visibility_enum,
            nullable=False,
            server_default='DEFAULT',
        ),
    )


def downgrade():
    op.drop_column('event', 'visibility')
    op.drop_column('event', 'transparency')
    transparency_enum.drop(op.get_bind())
    visibility_enum.drop(op.get_bind())
