"""Automatic protocols and final PDF integrity, preserving historical numbers."""
import hashlib
import re
from alembic import op
import sqlalchemy as sa

revision = '20260929_protocol'
down_revision = '20260929_revisions'
branch_labels = depends_on = None


def upgrade():
    with op.batch_alter_table('bulletins') as batch:
        batch.alter_column('bo_number', existing_type=sa.String(100), nullable=True)
        batch.add_column(sa.Column('emission_key', sa.Uuid(), nullable=True))
        batch.create_unique_constraint('uq_bulletins_emission_key', ['emission_key'])
    op.create_table('bulletin_sequences', sa.Column('date_key', sa.String(8), primary_key=True),
                    sa.Column('last_number', sa.Integer(), nullable=False))
    op.add_column('bulletin_revisions', sa.Column('pdf_sha256', sa.String(64), nullable=True))
    db = op.get_bind()
    sequences = {}
    for number in db.execute(sa.text('SELECT bo_number FROM bulletins WHERE bo_number IS NOT NULL')).scalars():
        match = re.fullmatch(r'(\d{8})-(\d+)', number)
        if match:
            day, value = match.groups()
            sequences[day] = max(sequences.get(day, 0), int(value))
    for day, value in sequences.items():
        db.execute(sa.text('INSERT INTO bulletin_sequences (date_key,last_number) VALUES (:day,:value)'), {'day': day, 'value': value})
    meta = sa.MetaData()
    revisions = sa.Table('bulletin_revisions', meta, autoload_with=db)
    files = sa.Table('pdf_files', meta, autoload_with=db)
    for row in db.execute(sa.select(revisions.c.id, files.c.content).join(files, files.c.key == revisions.c.pdf_storage_key)):
        db.execute(revisions.update().where(revisions.c.id == row.id).values(pdf_sha256=hashlib.sha256(row.content).hexdigest()))


def downgrade():
    db = op.get_bind()
    if db.scalar(sa.text('SELECT count(*) FROM bulletins')):
        raise RuntimeError('Reversão com boletins exige exportação e plano de restauração.')
    op.drop_column('bulletin_revisions', 'pdf_sha256')
    op.drop_table('bulletin_sequences')
    with op.batch_alter_table('bulletins') as batch:
        batch.drop_constraint('uq_bulletins_emission_key', type_='unique')
        batch.drop_column('emission_key')
        batch.alter_column('bo_number', existing_type=sa.String(100), nullable=False)
