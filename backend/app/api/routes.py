import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, Header
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.orm.exc import StaleDataError
from app.auth.security import admin, current_user, operator, dummy_hash, hasher, token_for, verify
from app.db.session import get_db
from app.models.entities import AuditLog, Bulletin, BulletinRevision, User
from app.repositories.bulletins import accessible, assign, present
from app.schemas.bulletin import CreateBulletin, ResendInput, UpdateBulletin, RevisionInput, BulletinInput
from app.services.protocol import emission_retry
from app.pdf.generator import generate_pdf
import hashlib
from datetime import date
from app.schemas.user import Login, UserCreate, UserUpdate
from app.services.audit import audit
from app.services.bulletins import deliver, emit
from app.services.email_service import filename
from app.services.storage import DatabaseStorage
from pydantic import BaseModel, Field
from app.models.entities import now

router = APIRouter(prefix='/api')


class CancelInput(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


@router.post('/bo/{bulletin_id}/cancel')
def cancel(bulletin_id: uuid.UUID, data: CancelInput, user=Depends(admin), db: Session = Depends(get_db)):
    b = accessible(db, bulletin_id, user, lock=True)
    if b.status in ('CANCELLED', 'REMOVED'):
        raise HTTPException(409, 'Boletim já cancelado')
    reason = data.reason.strip()
    if len(reason) < 3:
        raise HTTPException(422, 'Informe o motivo do cancelamento')
    b.status = 'CANCELLED'
    b.cancelled_at = now()
    b.cancelled_by = user.id
    b.cancellation_reason = reason
    b.lifecycle = {**(b.lifecycle or {}), 'cancelled_by_name': user.name, 'cancelled_by_username': user.username or user.email}
    audit(db, user.id, 'BO_CANCELLED', b.id)
    save(db)
    return present(b)


@router.post('/bo/{bulletin_id}/remove')
def remove_bulletin(bulletin_id: uuid.UUID, data: CancelInput, user=Depends(admin), db: Session = Depends(get_db)):
    b = accessible(db, bulletin_id, user, lock=True)
    if b.status == 'REMOVED':
        raise HTTPException(409, 'Boletim já removido')
    if len(data.reason.strip()) < 3:
        raise HTTPException(422, 'Informe o motivo')
    b.status, b.deleted_at, b.deleted_by, b.deletion_reason = 'REMOVED', now(), user.id, data.reason.strip()
    b.lifecycle = {**(b.lifecycle or {}), 'deleted_by_name': user.name, 'deleted_by_username': user.username or user.email}
    audit(db, user.id, 'BO_REMOVED', b.id)
    save(db)
    return present(b)


@router.post('/bo/{bulletin_id}/revise')
def revise(bulletin_id: uuid.UUID, data: RevisionInput, user=Depends(admin), db: Session = Depends(get_db)):
    b = accessible(db, bulletin_id, user, lock=True)
    if b.status != 'ISSUED':
        raise HTTPException(409, 'Somente boletins emitidos podem receber revisão')
    if b.version != data.version:
        raise HTTPException(409, 'Boletim alterado em outro dispositivo. Atualize antes de continuar.')
    if data.data.bo_number and data.data.bo_number != b.bo_number:
        raise HTTPException(422, 'A revisão deve preservar o número do BO')
    b.edited_by, b.edited_at, b.edit_reason = user.id, now(), data.reason
    b.lifecycle = {**(b.lifecycle or {}), 'edited_by_name': user.name, 'edited_by_username': user.username or user.email}
    assign(db, b, data.data)
    emit(db, b, data.data, user.id, data.reason)
    # A new PDF has not been sent. Explicit resend is required after correction.
    b.recipient_email_status = b.battalion_email_status = 'NOT_SENT'
    b.recipient_email_sent_at = b.battalion_email_sent_at = None
    audit(db, user.id, 'BO_ADMIN_EDITED', b.id)
    save(db)
    return present(b)


@router.get('/bo/{bulletin_id}/revisions')
def revisions(bulletin_id: uuid.UUID, user=Depends(admin), db: Session = Depends(get_db)):
    accessible(db, bulletin_id, user)
    return [{'version': r.version, 'created_at': r.created_at, 'actor_name': r.actor_name_snapshot,
             'actor_username': r.actor_username_snapshot, 'reason': r.reason,
             'involved_count': r.involved_count, 'pdf_layout_version': r.pdf_layout_version, 'pdf_sha256': r.pdf_sha256}
            for r in db.scalars(select(BulletinRevision).where(BulletinRevision.bulletin_id == bulletin_id).order_by(BulletinRevision.version.desc()))]


@router.get('/bo/{bulletin_id}/revisions/{version}/pdf')
def revision_pdf(bulletin_id: uuid.UUID, version: int, user=Depends(admin), db: Session = Depends(get_db)):
    b = accessible(db, bulletin_id, user)
    r = db.scalar(select(BulletinRevision).where(BulletinRevision.bulletin_id == bulletin_id, BulletinRevision.version == version))
    if not r:
        raise HTTPException(404, 'Revisão não encontrada')
    content = DatabaseStorage(db).get(r.pdf_storage_key)
    audit(db, user.id, 'PDF_DOWNLOADED', b.id)
    save(db)
    return Response(content, media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename="v{version}_{filename(b.bo_number)}"', 'Cache-Control': 'no-store'})


def save(db):
    try:
        db.commit()
    except (IntegrityError, StaleDataError):
        db.rollback()
        raise HTTPException(409, 'Registro duplicado ou alterado por outra sessão. Atualize e tente novamente.') from None


def user_view(u):
    return {'id': str(u.id), 'email': u.email, 'username': u.username or u.email, 'name': u.name, 'role': u.role, 'active': u.active}


@router.post('/auth/login')
def login(data: Login, db: Session = Depends(get_db)):
    identity = str(data.username or data.email).strip().lower()
    user = db.scalar(select(User).where((User.username == identity) | (User.email == identity)))
    valid = verify(data.password, user.password_hash if user else dummy_hash)
    if not user or not valid or not user.active:
        raise HTTPException(401, 'Usuário ou senha inválidos')
    audit(db, user.id, 'USER_LOGIN')
    save(db)
    return {'access_token': token_for(user), 'token_type': 'bearer', 'user': user_view(user)}


@router.get('/auth/me')
def me(user=Depends(current_user)):
    return user_view(user)


def emission_view(b, user):
    if user.role == 'GERADOR':
        return {'id': str(b.id), 'bo_number': b.bo_number, 'status': b.status, 'current_revision': b.current_revision}
    return present(b)


@router.post('/bo', status_code=201)
def create(data: CreateBulletin, tasks: BackgroundTasks, user=Depends(current_user), db: Session = Depends(get_db), idempotency_key: uuid.UUID | None = Header(None)):
    if data.emit:
        previous = emission_retry(db, idempotency_key, user)
        if previous:
            return emission_view(previous, user)
    bulletin = Bulletin(id=uuid.uuid4(), created_by=user.id)
    assign(db, bulletin, data.data)
    db.add(bulletin)
    audit(db, user.id, 'BO_CREATED', bulletin.id)
    if data.emit:
        bulletin.emission_key = idempotency_key
        emit(db, bulletin, data.data, user.id)
    save(db)
    if data.emit:
        tasks.add_task(deliver, bulletin.id, user.id)
    return emission_view(bulletin, user) if data.emit else present(bulletin)


@router.get('/bo')
def listing(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), status: str | None = None, search: str = Query('', max_length=100), q: str = Query('', max_length=100), date_from: date | None = None, date_to: date | None = None, occurrence_type: str = Query('', max_length=200), city: str = Query('', max_length=100), created_by: uuid.UUID | None = None, revision: int | None = Query(None, ge=0), user=Depends(operator), db: Session = Depends(get_db)):
    query = select(Bulletin).join(User, Bulletin.created_by == User.id)
    if status:
        if status not in ('DRAFT', 'ISSUED', 'CANCELLED', 'REMOVED'):
            raise HTTPException(422, 'Status inválido')
        query = query.where(Bulletin.status == status)
    else:
        query = query.where(Bulletin.status != 'REMOVED')
    if search or q:
        pattern = '%' + (q or search) + '%'
        query = query.where(Bulletin.bo_number.ilike(pattern) | Bulletin.data['occurrence_type'].as_string().ilike(pattern) | Bulletin.data['occurrence_summary'].as_string().ilike(pattern) | User.name.ilike(pattern) | User.username.ilike(pattern) | Bulletin.registered_by_name_snapshot.ilike(pattern) | Bulletin.registered_by_username_snapshot.ilike(pattern))
    query = filter_bulletins(query, date_from, date_to, occurrence_type)
    if city:
        query = query.where(Bulletin.data['location']['city'].as_string().ilike('%' + city + '%'))
    if created_by:
        query = query.where(Bulletin.created_by == created_by)
    if revision is not None:
        query = query.where(Bulletin.current_revision == revision)
    if user.role != 'ADMIN':
        query = query.where(Bulletin.created_by == user.id, Bulletin.status != 'REMOVED')
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.options(selectinload(Bulletin.people)).order_by(Bulletin.created_at.desc()).offset((page-1)*size).limit(size)).all()
    # List endpoint intentionally omits personal data and narrative.
    return {'total': total, 'page': page, 'size': size, 'items': [{
        'id': str(b.id), 'bo_number': b.bo_number, 'bulletin_type': b.bulletin_type,
        'created_by': str(b.created_by), 'created_by_name': b.registered_by_name_snapshot or b.creator.name, 'created_by_username': b.registered_by_username_snapshot or b.creator.username or b.creator.email, 'status': b.status, 'occurrence_type': b.data['occurrence_type'],
        'occurrence_date': b.data['occurrence_date'], 'pdf_generated_at': b.pdf_generated_at,
        'occurrence_summary': b.data.get('occurrence_summary', ''), 'city': b.data.get('location', {}).get('city', ''),
        'current_revision': b.current_revision, 'updated_at': b.updated_at, 'involved_count': len(b.people),
        'draft_step': b.data.get('draft_step', 0),
        **person_progress(b.people),
        'battalion_email_status': b.battalion_email_status, 'recipient_email_status': b.recipient_email_status,
    } for b in rows]}


def person_progress(people):
    from app.schemas.bulletin import Person
    from pydantic import ValidationError
    complete = 0
    for person in people:
        try:
            Person.model_validate(person.data)
            complete += 1
        except ValidationError:
            pass
    return {'complete_count': complete, 'pending_count': len(people) - complete}


def filter_bulletins(query, date_from=None, date_to=None, occurrence_type=''):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, 'Período inválido.')
    if date_from:
        query = query.where(Bulletin.data['occurrence_date'].as_string() >= date_from.isoformat())
    if date_to:
        query = query.where(Bulletin.data['occurrence_date'].as_string() <= date_to.isoformat())
    if occurrence_type:
        query = query.where(Bulletin.data['occurrence_type'].as_string().ilike('%' + occurrence_type + '%'))
    return query


@router.get('/operational-options')
def operational_options(user=Depends(operator), db: Session = Depends(get_db)):
    owned = select(Bulletin).where(Bulletin.created_by == user.id, Bulletin.status != 'REMOVED')
    last = db.scalar(owned.order_by(Bulletin.updated_at.desc()).limit(1))
    types = db.scalars(select(Bulletin.data['occurrence_type'].as_string()).where(Bulletin.created_by == user.id, Bulletin.status != 'REMOVED').distinct().limit(100)).all()
    return {'occurrence_types': sorted(t for t in types if t), 'team': [t.data for t in last.team] if last else [],
            'delivery': {'unit': last.data.get('delivery', {}).get('unit', '')} if last else {}}


@router.get('/admin/stats')
def statistics(date_from: date | None = None, date_to: date | None = None, status: str | None = None,
               occurrence_type: str = Query('', max_length=200), user=Depends(admin), db: Session = Depends(get_db)):
    query = filter_bulletins(select(Bulletin), date_from, date_to, occurrence_type)
    if status:
        if status not in ('DRAFT', 'ISSUED', 'CANCELLED', 'REMOVED'):
            raise HTTPException(422, 'Status inválido.')
        query = query.where(Bulletin.status == status)
    rows = query.subquery()
    counts = dict(db.execute(select(rows.c.status, func.count()).group_by(rows.c.status)).all())
    types = db.execute(select(rows.c.data['occurrence_type'].as_string().label('type'), func.count().label('count')).group_by('type').order_by(func.count().desc()).limit(10)).mappings().all()
    return {'total': sum(counts.values()), 'statuses': counts, 'revised': db.scalar(select(func.count()).select_from(rows).where(rows.c.current_revision > 1)),
            'email_failed': db.scalar(select(func.count()).select_from(rows).where((rows.c.recipient_email_status == 'FAILED') | (rows.c.battalion_email_status == 'FAILED'))), 'types': types}


@router.get('/bo/active-draft')
def active_draft(user=Depends(current_user), db: Session = Depends(get_db)):
    b = db.scalar(select(Bulletin).where(Bulletin.created_by == user.id, Bulletin.status == 'DRAFT').order_by(Bulletin.updated_at.desc()).limit(1))
    return present(b) if b else None


@router.get('/bo/{bulletin_id}')
def detail(bulletin_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    return present(accessible(db, bulletin_id, user))


@router.put('/bo/{bulletin_id}')
def update(bulletin_id: uuid.UUID, data: UpdateBulletin, tasks: BackgroundTasks, user=Depends(current_user), db: Session = Depends(get_db), idempotency_key: uuid.UUID | None = Header(None)):
    if data.emit:
        previous = emission_retry(db, idempotency_key, user, bulletin_id)
        if previous:
            return emission_view(previous, user)
    b = accessible(db, bulletin_id, user, lock=True)
    if b.status != 'DRAFT':
        raise HTTPException(409, 'Boletim emitido não pode ser alterado')
    if b.version != data.version:
        raise HTTPException(409, 'Este rascunho foi alterado em outro dispositivo. Atualize a página.')
    assign(db, b, data.data)
    audit(db, user.id, 'BO_UPDATED', b.id)
    if data.emit:
        b.emission_key = idempotency_key
        emit(db, b, data.data, user.id)
    save(db)
    if data.emit:
        tasks.add_task(deliver, b.id, user.id)
    return emission_view(b, user) if data.emit else present(b)


@router.get('/bo/{bulletin_id}/pdf')
def download(bulletin_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    b = accessible(db, bulletin_id, user)
    if b.status != 'ISSUED' or not b.pdf_storage_key:
        raise HTTPException(409, 'PDF ainda não foi gerado')
    try:
        content = DatabaseStorage(db).get(b.pdf_storage_key)
    except FileNotFoundError:
        raise HTTPException(503, 'PDF temporariamente indisponível') from None
    audit(db, user.id, 'PDF_DOWNLOADED', b.id)
    save(db)
    return Response(content, media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename="{filename(b.bo_number)}"', 'Cache-Control': 'no-store'})


class EmitInput(BaseModel):
    version: int = Field(ge=1)


@router.post('/bo/{bulletin_id}/emit')
def issue(bulletin_id: uuid.UUID, data: EmitInput, tasks: BackgroundTasks,
          idempotency_key: uuid.UUID = Header(), user=Depends(current_user), db: Session = Depends(get_db)):
    previous = emission_retry(db, idempotency_key, user, bulletin_id)
    if previous:
        return emission_view(previous, user)
    b = accessible(db, bulletin_id, user, lock=True)
    if b.status != 'DRAFT':
        raise HTTPException(409, 'Este boletim já foi emitido ou encerrado.')
    if b.version != data.version:
        raise HTTPException(409, 'Este rascunho foi alterado em outro dispositivo.')
    from pydantic import ValidationError
    try:
        validated = BulletinInput.model_validate(present(b)['data'])
    except ValidationError:
        raise HTTPException(422, 'Complete os campos obrigatórios antes de emitir.') from None
    b.emission_key = idempotency_key
    emit(db, b, validated, user.id)
    save(db)
    tasks.add_task(deliver, b.id, user.id)
    return emission_view(b, user)


@router.post('/bo/preview-pdf')
def preview(data: BulletinInput, user=Depends(current_user)):
    content = generate_pdf(data, registered_by=f'{user.name} ({user.username or user.email})', preview=True)
    return Response(content, media_type='application/pdf', headers={'Content-Disposition': 'inline; filename="previa.pdf"', 'Cache-Control': 'no-store'})


@router.get('/bo/{bulletin_id}/verify')
def verify_document(bulletin_id: uuid.UUID, revision: int = Query(ge=1), user=Depends(current_user), db: Session = Depends(get_db)):
    b = accessible(db, bulletin_id, user)
    r = db.scalar(select(BulletinRevision).where(BulletinRevision.bulletin_id == b.id, BulletinRevision.version == revision))
    if not r:
        raise HTTPException(404, 'Versão não encontrada.')
    digest = hashlib.sha256(DatabaseStorage(db).get(r.pdf_storage_key)).hexdigest()
    return {'bo_number': b.bo_number, 'version': r.version, 'status': b.status,
            'generated_at': r.created_at, 'pdf_sha256': r.pdf_sha256, 'matches': digest == r.pdf_sha256,
            'current_revision': b.current_revision}


@router.post('/bo/{bulletin_id}/resend-email', status_code=202)
def resend(bulletin_id: uuid.UUID, data: ResendInput, tasks: BackgroundTasks, user=Depends(admin), db: Session = Depends(get_db)):
    b = accessible(db, bulletin_id, user, lock=True)
    if b.status != 'ISSUED':
        raise HTTPException(409, 'Emita o boletim antes de reenviar')
    targets = ['recipient', 'battalion'] if data.target == 'both' else [data.target]
    if any(getattr(b, f'{t}_email_status') == 'PENDING' for t in targets):
        raise HTTPException(409, 'Envio já pendente. Aguarde o processamento.')
    for target in targets:
        setattr(b, f'{target}_email_status', 'PENDING')
        setattr(b, f'{target}_email_sent_at', None)
    audit(db, user.id, 'EMAIL_RESEND_REQUESTED', b.id)
    save(db)
    tasks.add_task(deliver, b.id, user.id, data.target)
    return present(b)


@router.get('/admin/users')
def users(page: int = Query(1, ge=1), user=Depends(admin), db: Session = Depends(get_db)):
    return [user_view(u) for u in db.scalars(select(User).order_by(User.username).offset((page-1)*50).limit(50))]


@router.post('/admin/users', status_code=201)
def create_user(data: UserCreate, user=Depends(admin), db: Session = Depends(get_db)):
    identity = data.username or str(data.email).lower()
    if db.scalar(select(User.id).where((User.username == identity) | (User.email == identity))):
        raise HTTPException(409, 'Nome de usuário já cadastrado.')
    new = User(username=data.username or str(data.email).lower(), email=str(data.email).lower() if data.email else None, name=data.name, password_hash=hasher.hash(data.password), role=data.role)
    db.add(new)
    audit(db, user.id, 'USER_CREATED')
    save(db)
    return user_view(new)


@router.patch('/admin/users/{user_id}')
def update_user(user_id: uuid.UUID, data: UserUpdate, user=Depends(admin), db: Session = Depends(get_db)):
    # Serialize administrator changes so concurrent requests cannot remove the last admin.
    db.scalars(select(User).where(User.role == 'ADMIN').order_by(User.id).with_for_update()).all()
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, 'Usuário não encontrado')
    if target.id == user.id and (data.active is False or data.role in ('OPERADOR', 'GERADOR')):
        raise HTTPException(409, 'Não é permitido remover o próprio acesso administrativo')
    if target.role == 'ADMIN' and target.active and (data.active is False or data.role in ('OPERADOR', 'GERADOR')):
        if db.scalar(select(func.count()).select_from(User).where(User.role == 'ADMIN', User.active.is_(True))) <= 1:
            raise HTTPException(409, 'Mantenha pelo menos um administrador ativo.')
    if data.username and db.scalar(select(User.id).where(User.id != target.id, (User.username == data.username) | (User.email == data.username))):
        raise HTTPException(409, 'Nome de usuário já cadastrado.')
    if data.name is not None:
        target.name = data.name.strip()
        if not target.name:
            raise HTTPException(422, 'Informe o nome completo.')
    if data.username is not None:
        target.username = data.username
    if data.active is not None:
        target.active = data.active
        audit(db, user.id, 'USER_ACTIVATED' if data.active else 'USER_DEACTIVATED')
    if data.role is not None:
        target.role = data.role
    if data.password:
        target.password_hash = hasher.hash(data.password)
        audit(db, user.id, 'USER_PASSWORD_RESET')
    audit(db, user.id, 'USER_UPDATED')
    save(db)
    return user_view(target)


@router.get('/admin/audit')
def audit_events(page: int = Query(1, ge=1), user=Depends(admin), db: Session = Depends(get_db)):
    return [{'id': str(a.id), 'user_id': str(a.user_id), 'user_name': a.actor_name_snapshot or (actor.name if actor else None),
             'username': a.actor_username_snapshot or ((actor.username or actor.email) if actor else None),
             'bulletin_id': str(a.bulletin_id) if a.bulletin_id else None,
             'report_id': str(a.report_id) if a.report_id else None,
             'action': a.action, 'result': a.result, 'created_at': a.created_at}
            for a, actor in db.execute(select(AuditLog, User).outerjoin(User, AuditLog.user_id == User.id)
                                      .order_by(AuditLog.created_at.desc()).offset((page-1)*50).limit(50))]
