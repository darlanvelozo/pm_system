from sqlalchemy import select
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import Bulletin, now
from app.pdf.generator import generate_pdf
from app.services.audit import audit
from app.services.email_service import send_bulletin_pdf
from app.services.storage import DatabaseStorage


def emit(db, bulletin, data, user_id):
    content = generate_pdf(data)
    key = f'{bulletin.id}.pdf'
    DatabaseStorage(db).put(key, content)
    bulletin.pdf_storage_key = key
    bulletin.pdf_generated_at = now()
    bulletin.status = 'ISSUED'
    audit(db, user_id, 'PDF_GENERATED', bulletin.id)


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
