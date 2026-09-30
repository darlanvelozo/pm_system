"""analytical_reports"""
from alembic import op
import sqlalchemy as sa

revision = '20260930_reports'
down_revision = '20260929_protocol'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('analytical_report_sequences',
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('last_number', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('year')
    )
    op.create_table('analytical_reports',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_by', sa.Uuid(), nullable=False),
    sa.Column('report_number', sa.String(length=100), nullable=True),
    sa.Column('emission_key', sa.Uuid(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('data', sa.JSON(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('current_revision', sa.Integer(), nullable=False),
    sa.Column('registered_by_name_snapshot', sa.String(length=150), nullable=True),
    sa.Column('registered_by_username_snapshot', sa.String(length=254), nullable=True),
    sa.Column('recipient_email', sa.String(length=254), nullable=False),
    sa.Column('recipient_email_status', sa.String(length=20), nullable=False),
    sa.Column('battalion_email_status', sa.String(length=20), nullable=False),
    sa.Column('recipient_email_sent_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('battalion_email_sent_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('pdf_storage_key', sa.String(length=100), nullable=True),
    sa.Column('pdf_generated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancelled_by', sa.Uuid(), nullable=True),
    sa.Column('cancellation_reason', sa.String(length=500), nullable=True),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.String(length=500), nullable=True),
    sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('edited_by', sa.Uuid(), nullable=True),
    sa.Column('edit_reason', sa.String(length=500), nullable=True),
    sa.Column('lifecycle', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['cancelled_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['deleted_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['edited_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('emission_key'),
    sa.UniqueConstraint('report_number')
    )
    op.create_index(op.f('ix_analytical_reports_created_by'), 'analytical_reports', ['created_by'], unique=False)
    op.create_table('analytical_report_revisions',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('report_id', sa.Uuid(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_by', sa.Uuid(), nullable=False),
    sa.Column('actor_name_snapshot', sa.String(length=150), nullable=False),
    sa.Column('actor_username_snapshot', sa.String(length=254), nullable=False),
    sa.Column('reason', sa.String(length=500), nullable=False),
    sa.Column('pdf_storage_key', sa.String(length=100), nullable=False),
    sa.Column('pdf_sha256', sa.String(length=64), nullable=False),
    sa.Column('pdf_layout_version', sa.String(length=30), nullable=False),
    sa.Column('data', sa.JSON(), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['report_id'], ['analytical_reports.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('report_id', 'version')
    )
    op.create_index(op.f('ix_analytical_report_revisions_report_id'), 'analytical_report_revisions', ['report_id'], unique=False)
    op.add_column('audit_logs', sa.Column('report_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fk_audit_logs_report', 'audit_logs', 'analytical_reports', ['report_id'], ['id'])

def downgrade():
    db = op.get_bind()
    if db.scalar(sa.text('SELECT count(*) FROM analytical_reports')):
        raise RuntimeError('Reports exist; export and plan restoration before downgrade.')
    op.drop_constraint('fk_audit_logs_report', 'audit_logs', type_='foreignkey')
    op.drop_column('audit_logs', 'report_id')
    op.drop_index(op.f('ix_analytical_report_revisions_report_id'), table_name='analytical_report_revisions')
    op.drop_table('analytical_report_revisions')
    op.drop_index(op.f('ix_analytical_reports_created_by'), table_name='analytical_reports')
    op.drop_table('analytical_reports')
    op.drop_table('analytical_report_sequences')
