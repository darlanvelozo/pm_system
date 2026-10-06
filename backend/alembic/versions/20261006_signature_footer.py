"""Analytical report footer lines and scanned signatory signature (stored only in the database)."""
from alembic import op
import sqlalchemy as sa
revision = '20261006_signature_footer'
down_revision = '20261002_settings'
branch_labels = depends_on = None


def upgrade():
    op.add_column('system_settings', sa.Column('footer_address', sa.String(200), nullable=True))
    op.add_column('system_settings', sa.Column('footer_contact', sa.String(200), nullable=True))
    op.add_column('system_settings', sa.Column('signature_image', sa.LargeBinary(), nullable=True))
    op.add_column('system_settings', sa.Column('signature_mime', sa.String(20), nullable=True))


def downgrade():
    # Footer falls back to "unit · city"; the uploaded signature is discarded.
    for column in ('signature_mime', 'signature_image', 'footer_contact', 'footer_address'):
        op.drop_column('system_settings', column)
