"""System settings editable by ADMIN and non-sensitive audit details."""
from alembic import op
import sqlalchemy as sa
revision = '20261002_settings'
down_revision = '20261002_two_roles'
branch_labels = depends_on = None


def upgrade():
    op.create_table('system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('unit_name', sa.String(150), nullable=True),
        sa.Column('unit_short_name', sa.String(60), nullable=True),
        sa.Column('unit_city', sa.String(100), nullable=True),
        sa.Column('battalion_email', sa.String(254), nullable=True),
        sa.Column('reply_to_email', sa.String(254), nullable=True),
        sa.Column('signatory_name', sa.String(150), nullable=True),
        sa.Column('signatory_rank', sa.String(100), nullable=True),
        sa.Column('signatory_title', sa.String(150), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_by', sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'))
    op.add_column('audit_logs', sa.Column('details', sa.JSON(), nullable=True))


def downgrade():
    # Settings fall back to environment variables after downgrade.
    op.drop_column('audit_logs', 'details')
    op.drop_table('system_settings')
