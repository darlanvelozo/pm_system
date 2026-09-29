"""Record cancellation without deleting bulletins or audit history."""
from alembic import op
import sqlalchemy as sa

revision = '20260928_cancel'
down_revision = '20260928_username'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('bulletins') as batch:
        batch.add_column(sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column('cancelled_by', sa.Uuid(), nullable=True))
        batch.add_column(sa.Column('cancellation_reason', sa.String(500), nullable=True))
        batch.create_foreign_key('fk_bulletins_cancelled_by', 'users', ['cancelled_by'], ['id'])


def downgrade():
    with op.batch_alter_table('bulletins') as batch:
        batch.drop_constraint('fk_bulletins_cancelled_by', type_='foreignkey')
        batch.drop_column('cancellation_reason')
        batch.drop_column('cancelled_by')
        batch.drop_column('cancelled_at')
