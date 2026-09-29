from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import select, text
from app.models.entities import Bulletin, BulletinSequence
from fastapi import HTTPException


def next_protocol(db, instant=None):
    day = (instant or datetime.now(ZoneInfo('America/Fortaleza'))).astimezone(ZoneInfo('America/Fortaleza')).strftime('%Y%m%d')
    if db.bind.dialect.name == 'postgresql':
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    statement = insert(BulletinSequence).values(date_key=day, last_number=1)
    statement = statement.on_conflict_do_update(index_elements=['date_key'], set_={'last_number': BulletinSequence.last_number + 1}).returning(BulletinSequence.last_number)
    number = db.scalar(statement)
    return f'{day}-{number:02d}'


def emission_retry(db, key, user, bulletin_id=None):
    if key is None:
        raise HTTPException(422, 'Informe Idempotency-Key para emitir.')
    # Serializes the same key even before a bulletin row exists (legacy POST).
    if db.bind.dialect.name == 'postgresql':
        db.execute(text('SELECT pg_advisory_xact_lock(:key)'), {'key': int.from_bytes(key.bytes[:8], 'big', signed=True)})
    existing = db.scalar(select(Bulletin).where(Bulletin.emission_key == key))
    if existing and ((existing.created_by != user.id and user.role != 'ADMIN') or (bulletin_id and existing.id != bulletin_id)):
        raise HTTPException(409, 'Chave de emissão já utilizada em outra operação.')
    return existing
