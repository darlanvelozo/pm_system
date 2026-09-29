"""Preserve legacy PDFs, revisions and lifecycle identity."""
import uuid
from alembic import op
import sqlalchemy as sa
revision = '20260929_revisions'
down_revision = '20260929_identity'
branch_labels = depends_on = None


def upgrade():
    with op.batch_alter_table('bulletins') as batch:
        batch.add_column(sa.Column('registered_by_name_snapshot', sa.String(150)))
        batch.add_column(sa.Column('registered_by_username_snapshot', sa.String(254)))
        batch.add_column(sa.Column('lifecycle', sa.JSON(), nullable=False, server_default='{}'))
        batch.add_column(sa.Column('current_revision', sa.Integer(), nullable=False, server_default='0'))
        for prefix in ('deleted', 'edited'):
            batch.add_column(sa.Column(prefix + '_at', sa.DateTime(timezone=True)))
            batch.add_column(sa.Column(prefix + '_by', sa.Uuid()))
            batch.create_foreign_key('fk_bulletins_' + prefix, 'users', [prefix + '_by'], ['id'])
        batch.add_column(sa.Column('deletion_reason', sa.String(500)))
        batch.add_column(sa.Column('edit_reason', sa.String(500)))
    op.create_table('bulletin_revisions',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('bulletin_id', sa.Uuid(), sa.ForeignKey('bulletins.id'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.Uuid(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('actor_name_snapshot', sa.String(150), nullable=False),
        sa.Column('actor_username_snapshot', sa.String(254), nullable=False),
        sa.Column('reason', sa.String(500), nullable=False),
        sa.Column('pdf_storage_key', sa.String(100), nullable=False),
        sa.Column('pdf_layout_version', sa.String(30), nullable=False),
        sa.Column('involved_count', sa.Integer(), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.UniqueConstraint('bulletin_id', 'version'))
    op.create_index('ix_bulletin_revisions_bulletin_id', 'bulletin_revisions', ['bulletin_id'])
    db = op.get_bind()
    meta = sa.MetaData()
    tables = {name: sa.Table(name, meta, autoload_with=db) for name in ('bulletins', 'users', 'people_involved', 'police_teams', 'bulletin_revisions')}
    b, u = tables['bulletins'], tables['users']
    for record in db.execute(sa.select(b)).mappings().all():
        actor = db.execute(sa.select(u).where(u.c.id == record['created_by'])).mappings().one()
        changes = {}
        if record['cancelled_by']:
            cancelled = db.execute(sa.select(u).where(u.c.id == record['cancelled_by'])).mappings().one()
            changes['lifecycle'] = {'cancelled_by_name': cancelled['name'], 'cancelled_by_username': cancelled['username'] or cancelled['email']}
        if record['pdf_storage_key']:
            people = tables['people_involved']
            team = tables['police_teams']
            data = dict(record['data'])
            data['people'] = [{**p['data'], 'id': str(p['id'])} for p in db.execute(sa.select(people).where(people.c.bulletin_id == record['id']).order_by(people.c.position)).mappings()]
            data['team'] = [t['data'] for t in db.execute(sa.select(team).where(team.c.bulletin_id == record['id']).order_by(team.c.position)).mappings()]
            db.execute(tables['bulletin_revisions'].insert().values(id=uuid.uuid4(), bulletin_id=record['id'], version=1,
                created_at=record['pdf_generated_at'] or record['created_at'], created_by=actor['id'], actor_name_snapshot=actor['name'],
                actor_username_snapshot=actor['username'] or actor['email'], reason='Emissão anterior à migração; identidade disponível na migração',
                pdf_storage_key=record['pdf_storage_key'], pdf_layout_version='legacy', involved_count=len(data['people']), data=data))
            changes.update(current_revision=1, registered_by_name_snapshot=actor['name'], registered_by_username_snapshot=actor['username'] or actor['email'])
        if changes:
            db.execute(b.update().where(b.c.id == record['id']).values(**changes))


def downgrade():
    raise RuntimeError('Revisões preservadas: reversão exige plano explícito de exportação e restauração.')
