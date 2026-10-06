import uuid
from datetime import date
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Response
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.auth.security import admin, creator, operator
from app.db.session import get_db
from app.models.entities import User, now
from app.models.analytical_report import AnalyticalReport, AnalyticalReportRevision
from app.schemas.analytical_report import CreateReport, UpdateReport, ReviseReport, ReportInput
from app.schemas.bulletin import ResendInput
from app.api.routes import save, CancelInput, EmitInput
from app.services import analytical_reports as service
from app.services.audit import audit
from app.services.storage import DatabaseStorage
from app.pdf.analytical_report import generate_report_pdf
from app.services.system_settings import authority, effective_settings, signature

router = APIRouter(prefix='/api/analytical-reports', dependencies=[Depends(creator)])


@router.post('', status_code=201)
def create(data: CreateReport, user=Depends(creator), db: Session = Depends(get_db)):
    r = AnalyticalReport(id=uuid.uuid4(), created_by=user.id, data=data.data.model_dump(mode='json'), recipient_email=data.data.recipient_email)
    db.add(r)
    audit(db, user.id, 'ANALYTICAL_REPORT_CREATED', report_id=r.id)
    save(db)
    return service.present(r)


@router.get('')
def listing(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), q: str = Query('', max_length=100),
            status: str | None = None, date_from: date | None = None, date_to: date | None = None,
            occurrence_type: str = Query('', max_length=200), city: str = Query('', max_length=200),
            created_by: uuid.UUID | None = None, user=Depends(creator), db: Session = Depends(get_db)):
    if user.role == 'BASICO' and status != 'DRAFT':
        # Usuário básico lists only own drafts ("Meus rascunhos"), never emitted reports.
        raise HTTPException(403, 'Este perfil acessa somente os próprios rascunhos.')
    r = AnalyticalReport
    query = select(r).join(User, r.created_by == User.id)
    if user.role != 'ADMIN':
        query = query.where(r.created_by == user.id, r.status != 'REMOVED')
    if status:
        if status not in ('DRAFT', 'ISSUED', 'CANCELLED', 'REMOVED'):
            raise HTTPException(422, 'Status inválido.')
        query = query.where(r.status == status)
    else:
        query = query.where(r.status != 'REMOVED')
    if q:
        pattern = f'%{q}%'
        query = query.where(r.report_number.ilike(pattern) | r.data['occurrence_type'].as_string().ilike(pattern) |
            User.name.ilike(pattern) | User.username.ilike(pattern) | r.registered_by_name_snapshot.ilike(pattern) | r.registered_by_username_snapshot.ilike(pattern))
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, 'Período inválido.')
    if date_from:
        query = query.where(r.data['occurrence_date'].as_string() >= date_from.isoformat())
    if date_to:
        query = query.where(r.data['occurrence_date'].as_string() <= date_to.isoformat())
    if occurrence_type:
        query = query.where(r.data['occurrence_type'].as_string().ilike(f'%{occurrence_type}%'))
    if city:
        query = query.where(r.data['closing_location'].as_string().ilike(f'%{city}%'))
    if created_by:
        query = query.where(r.created_by == created_by)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(r.created_at.desc()).offset((page-1)*size).limit(size))
    return {'items': [service.present(r, full=False) for r in rows], 'page': page, 'size': size, 'total': total}


@router.post('/preview-pdf')
def preview(data: ReportInput, user=Depends(creator), db: Session = Depends(get_db)):
    unit = effective_settings(db)
    content = generate_report_pdf(data, registered_by=f'{user.name} ({user.username or user.email})', preview=True,
                                  authority=authority(unit), unit=unit, signature=signature(db))
    audit(db, user.id, 'ANALYTICAL_REPORT_PREVIEWED')
    save(db)
    return Response(content, media_type='application/pdf', headers={'Content-Disposition': 'inline; filename="previa-relatorio.pdf"'})


@router.get('/{report_id}')
def detail(report_id: uuid.UUID, user=Depends(creator), db: Session = Depends(get_db)):
    return service.present(service.accessible(db, report_id, user))


@router.put('/{report_id}')
def update(report_id: uuid.UUID, data: UpdateReport, user=Depends(creator), db: Session = Depends(get_db)):
    r = service.accessible(db, report_id, user, lock=True)
    if r.status != 'DRAFT' or r.version != data.version:
        raise HTTPException(409, 'Relatório emitido ou alterado em outro dispositivo. Recarregue a versão do servidor.')
    r.data = data.data.model_dump(mode='json')
    r.recipient_email = data.data.recipient_email
    audit(db, user.id, 'ANALYTICAL_REPORT_UPDATED', report_id=r.id)
    save(db)
    return service.present(r)


@router.post('/{report_id}/emit')
def emit(report_id: uuid.UUID, data: EmitInput, tasks: BackgroundTasks, idempotency_key: uuid.UUID = Header(),
         user=Depends(creator), db: Session = Depends(get_db)):
    previous = service.retry(db, idempotency_key, user, report_id)
    if previous:
        return service.emission_view(previous, user)
    r = service.accessible(db, report_id, user, lock=True)
    if r.status != 'DRAFT' or r.version != data.version:
        raise HTTPException(409, 'Relatório emitido ou alterado em outro dispositivo.')
    try:
        valid = ReportInput.model_validate(r.data)
    except ValidationError:
        raise HTTPException(422, 'Complete os campos obrigatórios antes de emitir.') from None
    r.emission_key = idempotency_key
    service.emit(db, r, valid, user)
    audit(db, user.id, 'ANALYTICAL_REPORT_EMITTED', report_id=r.id)
    save(db)
    tasks.add_task(service.deliver, r.id, user.id)
    return service.emission_view(r, user)


def pdf_response(db, r, user, revision):
    if not revision:
        raise HTTPException(404, 'PDF não encontrado.')
    try:
        content = DatabaseStorage(db).get(revision.pdf_storage_key)
    except FileNotFoundError:
        raise HTTPException(503, 'PDF temporariamente indisponível.') from None
    audit(db, user.id, 'ANALYTICAL_REPORT_PDF_DOWNLOADED', report_id=r.id)
    save(db)
    number = r.report_number.replace('/', '-')
    return Response(content, media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename="RELATORIO_ANALITICO_{number}_v{revision.version}.pdf"', 'Cache-Control': 'no-store'})


@router.get('/{report_id}/pdf')
def pdf(report_id: uuid.UUID, user=Depends(operator), db: Session = Depends(get_db)):
    r = service.accessible(db, report_id, user)
    if r.status != 'ISSUED':
        raise HTTPException(409, 'Relatório não está emitido.')
    revision = db.scalar(select(AnalyticalReportRevision).where(AnalyticalReportRevision.report_id == r.id, AnalyticalReportRevision.version == r.current_revision))
    return pdf_response(db, r, user, revision)


@router.post('/{report_id}/revise')
def revise(report_id: uuid.UUID, data: ReviseReport, user=Depends(admin), db: Session = Depends(get_db)):
    r = service.accessible(db, report_id, user, lock=True)
    if r.status != 'ISSUED' or r.version != data.version:
        raise HTTPException(409, 'Relatório encerrado ou alterado em outro dispositivo.')
    if len(data.reason.strip()) < 3:
        raise HTTPException(422, 'Informe o motivo.')
    r.edited_by, r.edited_at, r.edit_reason = user.id, now(), data.reason.strip()
    r.lifecycle = {**r.lifecycle, 'edited_by_name': user.name, 'edited_by_username': user.username or user.email}
    service.emit(db, r, data.data, user, data.reason.strip())
    audit(db, user.id, 'ANALYTICAL_REPORT_REVISED', report_id=r.id)
    save(db)
    return service.present(r)


@router.get('/{report_id}/revisions')
def revisions(report_id: uuid.UUID, user=Depends(admin), db: Session = Depends(get_db)):
    service.accessible(db, report_id, user)
    return [{k: getattr(r, k) for k in ('version', 'created_at', 'actor_name_snapshot', 'actor_username_snapshot', 'reason', 'pdf_sha256', 'pdf_layout_version')}
            for r in db.scalars(select(AnalyticalReportRevision).where(AnalyticalReportRevision.report_id == report_id).order_by(AnalyticalReportRevision.version.desc()))]


@router.get('/{report_id}/revisions/{version}/pdf')
def revision_pdf(report_id: uuid.UUID, version: int, user=Depends(admin), db: Session = Depends(get_db)):
    r = service.accessible(db, report_id, user)
    rev = db.scalar(select(AnalyticalReportRevision).where(AnalyticalReportRevision.report_id == report_id, AnalyticalReportRevision.version == version))
    return pdf_response(db, r, user, rev)


@router.post('/{report_id}/resend-email', status_code=202)
def resend(report_id: uuid.UUID, data: ResendInput, tasks: BackgroundTasks, user=Depends(admin), db: Session = Depends(get_db)):
    r = service.accessible(db, report_id, user, lock=True)
    targets = ('recipient', 'battalion') if data.target == 'both' else (data.target,)
    if r.status != 'ISSUED' or any(getattr(r, f'{t}_email_status') == 'PENDING' for t in targets):
        raise HTTPException(409, 'Relatório encerrado ou envio pendente.')
    for t in targets:
        setattr(r, f'{t}_email_status', 'PENDING')
        setattr(r, f'{t}_email_sent_at', None)
    audit(db, user.id, 'ANALYTICAL_REPORT_EMAIL_RESEND_REQUESTED', report_id=r.id)
    save(db)
    tasks.add_task(service.deliver, r.id, user.id, data.target)
    return service.present(r)


def lifecycle(db, r, user, action, reason):
    if len(reason.strip()) < 3:
        raise HTTPException(422, 'Informe o motivo.')
    if r.status == 'REMOVED' or (action == 'cancel' and r.status == 'CANCELLED'):
        raise HTTPException(409, 'Relatório já encerrado.')
    prefix = 'cancelled' if action == 'cancel' else 'deleted'
    r.status = 'CANCELLED' if action == 'cancel' else 'REMOVED'
    setattr(r, f'{prefix}_at', now())
    setattr(r, f'{prefix}_by', user.id)
    setattr(r, 'cancellation_reason' if action == 'cancel' else 'deletion_reason', reason.strip())
    r.lifecycle = {**r.lifecycle, f'{prefix}_by_name': user.name, f'{prefix}_by_username': user.username or user.email}
    audit(db, user.id, f'ANALYTICAL_REPORT_{r.status}', report_id=r.id)
    save(db)
    return service.present(r)


@router.post('/{report_id}/cancel')
def cancel(report_id: uuid.UUID, data: CancelInput, user=Depends(admin), db: Session = Depends(get_db)):
    return lifecycle(db, service.accessible(db, report_id, user, lock=True), user, 'cancel', data.reason)


@router.post('/{report_id}/remove')
def remove(report_id: uuid.UUID, data: CancelInput, user=Depends(admin), db: Session = Depends(get_db)):
    return lifecycle(db, service.accessible(db, report_id, user, lock=True), user, 'remove', data.reason)
