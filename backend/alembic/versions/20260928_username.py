"""Add independent usernames while preserving existing logins."""
from alembic import op
import sqlalchemy as sa

revision = '20260928_username'
down_revision = '0b1c21797571'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('username', sa.String(254), nullable=True))
    op.execute('UPDATE users SET username = lower(email)')
    with op.batch_alter_table('users') as batch:
        batch.create_unique_constraint('uq_users_username', ['username'])
        batch.alter_column('email', existing_type=sa.String(254), nullable=True)


def downgrade():
    connection = op.get_bind()
    if connection.execute(sa.text('SELECT count(*) FROM users WHERE email IS NULL')).scalar():
        raise RuntimeError('Cadastre e-mails nos usuários antes de reverter esta migration.')
    with op.batch_alter_table('users') as batch:
        batch.alter_column('email', existing_type=sa.String(254), nullable=False)
        batch.drop_constraint('uq_users_username', type_='unique')
        batch.drop_column('username')
