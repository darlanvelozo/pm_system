import hashlib
import re
import unicodedata
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import select, text
from app.db.session import SessionLocal
from app.models.entities import User, now
from app.models.analytical_report import AnalyticalReport, AnalyticalReportRevision, AnalyticalReportSequence
from app.pdf.analytical_report import generate_report_pdf, LAYOUT_VERSION
from app.services.audit import audit
from app.services.email_service import send_document_pdf
from app.services.email_summary import safe_metadata
from app.services.storage import DatabaseStorage
from app.services.system_settings import authority as authority_of, effective_settings, stored_reply_to


def next_report_number(db, instant=None):
    year = (instant or datetime.now(ZoneInfo('America/Fortaleza'))).astimezone(ZoneInfo('America/Fortaleza')).year
    if db.bind.dialect.name == 'postgresql':
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    stmt = insert(AnalyticalReportSequence).values(year=year, last_number=1)
    stmt = stmt.on_conflict_do_update(index_elements=['year'], set_={'last_number': AnalyticalReportSequence.last_number+1}).returning(AnalyticalReportSequence.last_number)
    return f'{db.scalar(stmt)}/{year}'


def retry(db, key, user, report_id):
    if db.bind.dialect.name == 'postgresql':
        db.execute(text('SELECT pg_advisory_xact_lock(:key)'), {'key': int.from_bytes(key.bytes[:8], 'big', signed=True)})
    r = db.scalar(select(AnalyticalReport).where(AnalyticalReport.emission_key == key))
    if r and (r.id != report_id or (r.created_by != user.id and user.role != 'ADMIN')):
        raise HTTPException(409, 'Chave de emissão já utilizada.')
    return r


def accessible(db, report_id, user, lock=False):
    query = select(AnalyticalReport).where(AnalyticalReport.id == report_id)
    if user.role != 'ADMIN':
        query = query.where(AnalyticalReport.created_by == user.id, AnalyticalReport.status != 'REMOVED')
    r = db.scalar(query.with_for_update() if lock else query)
    if not r:
        raise HTTPException(404, 'Relatório não encontrado.')
    return r


def present(r, full=True):
    result = {key: getattr(r, key) for key in ('id', 'report_number', 'status', 'version', 'current_revision', 'created_by',
        'created_at', 'updated_at', 'pdf_generated_at', 'recipient_email_status', 'battalion_email_status')}
    result.update(created_by_name=r.registered_by_name_snapshot or r.creator.name,
                  created_by_username=r.registered_by_username_snapshot or r.creator.username or r.creator.email,
                  occurrence_type=r.data.get('occurrence_type'), occurrence_date=r.data.get('occurrence_date'),
                  occurrence_time=r.data.get('occurrence_time'), city=r.data.get('closing_location'))
    if full:
        result.update(data=r.data, recipient_email=r.recipient_email, **(r.lifecycle or {}))
        result.update({k: getattr(r, k) for k in ('cancelled_at', 'cancellation_reason', 'deleted_at', 'deletion_reason', 'edited_at', 'edit_reason')})
    return result


def emit(db, report, data, actor, reason='Emissão inicial'):
    report.report_number = report.report_number or next_report_number(db)
    creator = db.get(User, report.created_by)
    if not report.registered_by_name_snapshot:
        report.registered_by_name_snapshot = creator.name
        report.registered_by_username_snapshot = creator.username or creator.email
    version = report.current_revision + 1
    unit = effective_settings(db)
    authority = authority_of(unit)
    content = generate_report_pdf(data, report.report_number, version,
        f'{report.registered_by_name_snapshot} ({report.registered_by_username_snapshot})', authority, unit=unit)
    key = f'analytical-reports/{report.id}/v{version}.pdf'
    DatabaseStorage(db).put(key, content)
    db.add(AnalyticalReportRevision(report_id=report.id, version=version, created_by=actor.id,
        actor_name_snapshot=actor.name, actor_username_snapshot=actor.username or actor.email, reason=reason,
        pdf_storage_key=key, pdf_sha256=hashlib.sha256(content).hexdigest(), pdf_layout_version=LAYOUT_VERSION,
        data={**data.model_dump(mode='json'), 'signatory': authority}))
    report.data = data.model_dump(mode='json')
    report.recipient_email = str(data.recipient_email)
    report.current_revision, report.pdf_storage_key, report.pdf_generated_at = version, key, now()
    report.status = 'ISSUED'
    report.recipient_email_status = report.battalion_email_status = 'PENDING' if version == 1 else 'NOT_SENT'
    report.recipient_email_sent_at = report.battalion_email_sent_at = None
    audit(db, actor.id, 'ANALYTICAL_REPORT_PDF_GENERATED', report_id=report.id)


def email_summary(report, unit_short='24º BPM'):
    data = report.data
    kind = safe_metadata(data.get('occurrence_type'), report)
    city = safe_metadata(data.get('closing_location'), report)
    # Free-text people/address/narrative never form part of email metadata.
    suffix = f' | Revisão {report.current_revision}' if report.current_revision > 1 else ''
    subject = f'Relatório Analítico {report.report_number} | {kind} | {city}' + suffix
    date = '/'.join(reversed((data.get('occurrence_date') or '').split('-')))
    body = (f'Prezados,\n\nSegue em anexo o Relatório Analítico de Ocorrência nº {report.report_number}.\n'
            f'Tipo de ocorrência: {kind}\nData/Hora: {date} às {data.get("occurrence_time", "")}\n'
            f'Local de emissão (município): {city}\n'
            f'Registrado por: {report.registered_by_name_snapshot} ({report.registered_by_username_snapshot})\n'
            f'Versão: {report.current_revision}\n\nO documento completo segue em anexo.\n'
            f'Mensagem gerada automaticamente pelo BO Online {unit_short}.')
    safe_kind = re.sub(r'[^A-Za-z0-9_-]', '_', unicodedata.normalize('NFKD', kind).encode('ascii', 'ignore').decode())[:60]
    attachment = f'RELATORIO_ANALITICO_{report.report_number.replace("/", "-")}_{safe_kind}_v{report.current_revision}.pdf'
    return subject, body, attachment


def deliver(report_id, actor_id, target='both'):
    for destination in ('battalion', 'recipient'):
        if target not in ('both', destination):
            continue
        with SessionLocal() as db:
            r = db.scalar(select(AnalyticalReport).where(AnalyticalReport.id == report_id).with_for_update())
            if not r or r.status != 'ISSUED' or getattr(r, f'{destination}_email_status') != 'PENDING':
                continue
            unit = effective_settings(db)
            recipient = unit['battalion_email'] if destination == 'battalion' else r.recipient_email
            try:
                sent = send_document_pdf(recipient, DatabaseStorage(db).get(r.pdf_storage_key),
                                         *email_summary(r, unit['unit_short_name']), stored_reply_to(db))
            except (FileNotFoundError, OSError):
                sent = False
            result = 'SENT' if sent else 'FAILED'
            setattr(r, f'{destination}_email_status', result)
            setattr(r, f'{destination}_email_sent_at', now() if sent else None)
            audit(db, actor_id, f'ANALYTICAL_REPORT_EMAIL_{result}', result=result, report_id=r.id)
            db.commit()
