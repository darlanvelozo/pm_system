"""Preserve identity displayed on audit events."""
from alembic import op
import sqlalchemy as sa
revision = '20260929_identity'
down_revision = '20260928_cancel'
branch_labels = depends_on = None


def upgrade():
    op.add_column('audit_logs', sa.Column('actor_name_snapshot', sa.String(150), nullable=True))
    op.add_column('audit_logs', sa.Column('actor_username_snapshot', sa.String(254), nullable=True))
    op.execute('UPDATE audit_logs SET actor_name_snapshot = (SELECT name FROM users WHERE users.id = audit_logs.user_id), actor_username_snapshot = (SELECT coalesce(username,email) FROM users WHERE users.id = audit_logs.user_id)')


def downgrade():
    op.drop_column('audit_logs', 'actor_username_snapshot')
    op.drop_column('audit_logs', 'actor_name_snapshot')
