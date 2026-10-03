"""Two roles only: GERADOR accounts become OPERADOR ("Usuário comum").

Downgrade is a no-op: the previous GERADOR assignment is not recorded, so it
cannot be restored. Accounts remain OPERADOR, which the older code also accepts.
"""
from alembic import op
revision = '20261002_two_roles'
down_revision = '20260930_reports'
branch_labels = depends_on = None


def upgrade():
    op.execute("UPDATE users SET role = 'OPERADOR' WHERE role = 'GERADOR'")


def downgrade():
    pass
