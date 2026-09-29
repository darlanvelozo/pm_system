from sqlalchemy import select
import hashlib
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import Bulletin, BulletinRevision, User, now
from app.pdf.generator import generate_pdf
from app.pdf.layout import PDF_LAYOUT_VERSION
from app.services.audit import audit
from app.services.email_service import send_bulletin_pdf
from app.services.storage import DatabaseStorage
from app.services.protocol import next_protocol


def emit(db, bulletin, data, user_id, reason='Emissão inicial'):
    if not bulletin.bo_number:
        bulletin.bo_number = next_protocol(db)
    data = data.model_copy(update={'bo_number': bulletin.bo_number})
    bulletin.data = {**bulletin.data, 'bo_number': bulletin.bo_number}
    creator = db.get(User, bulletin.created_by)
    actor = db.get(User, user_id)
    if not bulletin.registered_by_name_snapshot:
        bulletin.registered_by_name_snapshot = creator.name
        bulletin.registered_by_username_snapshot = creator.username or creator.email
    version = (bulletin.current_revision or 0) + 1
    content = generate_pdf(data, registered_by=f'{bulletin.registered_by_name_snapshot} ({bulletin.registered_by_username_snapshot})', version=version, bulletin_id=bulletin.id)
    key = f'{bulletin.id}/v{version}.pdf'
    DatabaseStorage(db).put(key, content)
    snapshot = data.model_dump(mode='json')
    snapshot['people'] = [{**p.data, 'id': str(p.id)} for p in bulletin.people]
    db.add(BulletinRevision(bulletin_id=bulletin.id, version=version, created_by=user_id,
        actor_name_snapshot=actor.name, actor_username_snapshot=actor.username or actor.email,
        reason=reason, pdf_storage_key=key, pdf_layout_version=PDF_LAYOUT_VERSION, pdf_sha256=hashlib.sha256(content).hexdigest(),
        involved_count=len(data.people), data=snapshot))
    bulletin.current_revision = version
    bulletin.pdf_storage_key = key
    bulletin.pdf_generated_at = now()
    bulletin.status = 'ISSUED'
    audit(db, user_id, 'PDF_GENERATED' if version == 1 else 'PDF_REGENERATED', bulletin.id)


def deliver(bulletin_id, user_id, target='both', force=False):
    # Lock each delivery independently, preserving successful first recipient on a crash.
    for destination in ('battalion', 'recipient'):
        if target not in ('both', destination):
            continue
        with SessionLocal() as db:
            b = db.scalar(select(Bulletin).where(Bulletin.id == bulletin_id).with_for_update())
            if not b or b.status != 'ISSUED':
                continue
            attr = f'{destination}_email_status'
            if not force and getattr(b, attr) != 'PENDING':
                continue
            recipient = str(settings().battalion_email) if destination == 'battalion' else b.recipient_email
            try:
                sent = send_bulletin_pdf(recipient, b, DatabaseStorage(db).get(b.pdf_storage_key))
            except (FileNotFoundError, OSError):
                sent = False
            status = 'SENT' if sent else 'FAILED'
            setattr(b, attr, status)
            setattr(b, f'{destination}_email_sent_at', now() if sent else None)
            audit(db, user_id, f'EMAIL_TO_{destination.upper()}_{status}', b.id, status)
            db.commit()
