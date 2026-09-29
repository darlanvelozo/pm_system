import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError
from app.auth.security import admin, current_user, dummy_hash, hasher, token_for, verify
from app.db.session import get_db
from app.models.entities import AuditLog, Bulletin, BulletinRevision, User
from app.repositories.bulletins import accessible, assign, present
from app.schemas.bulletin import CreateBulletin, ResendInput, UpdateBulletin, RevisionInput
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
    if data.data.bo_number != b.bo_number:
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
             'involved_count': r.involved_count, 'pdf_layout_version': r.pdf_layout_version}
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


@router.post('/bo', status_code=201)
def create(data: CreateBulletin, tasks: BackgroundTasks, user=Depends(current_user), db: Session = Depends(get_db)):
    bulletin = Bulletin(id=uuid.uuid4(), created_by=user.id)
    assign(db, bulletin, data.data)
    db.add(bulletin)
    audit(db, user.id, 'BO_CREATED', bulletin.id)
    if data.emit:
        emit(db, bulletin, data.data, user.id)
    save(db)
    if data.emit:
        tasks.add_task(deliver, bulletin.id, user.id)
    return present(bulletin)


@router.get('/bo')
def listing(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), status: str | None = None, search: str = Query('', max_length=100), user=Depends(current_user), db: Session = Depends(get_db)):
    query = select(Bulletin).join(User, Bulletin.created_by == User.id)
    if status:
        if status not in ('DRAFT', 'ISSUED', 'CANCELLED', 'REMOVED'):
            raise HTTPException(422, 'Status inválido')
        query = query.where(Bulletin.status == status)
    else:
        query = query.where(Bulletin.status != 'REMOVED')
    if search:
        pattern = '%' + search + '%'
        query = query.where(Bulletin.bo_number.ilike(pattern) | Bulletin.data['occurrence_type'].as_string().ilike(pattern) | User.name.ilike(pattern) | User.username.ilike(pattern) | Bulletin.registered_by_name_snapshot.ilike(pattern) | Bulletin.registered_by_username_snapshot.ilike(pattern))
    if user.role != 'ADMIN':
        query = query.where(Bulletin.created_by == user.id, Bulletin.status != 'REMOVED')
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Bulletin.created_at.desc()).offset((page-1)*size).limit(size)).all()
    # List endpoint intentionally omits personal data and narrative.
    return {'total': total, 'page': page, 'size': size, 'items': [{
        'id': str(b.id), 'bo_number': b.bo_number, 'bulletin_type': b.bulletin_type,
        'created_by': str(b.created_by), 'created_by_name': b.registered_by_name_snapshot or b.creator.name, 'created_by_username': b.registered_by_username_snapshot or b.creator.username or b.creator.email, 'status': b.status, 'occurrence_type': b.data['occurrence_type'],
        'occurrence_date': b.data['occurrence_date'], 'pdf_generated_at': b.pdf_generated_at,
        'battalion_email_status': b.battalion_email_status, 'recipient_email_status': b.recipient_email_status,
    } for b in rows]}


@router.get('/bo/{bulletin_id}')
def detail(bulletin_id: uuid.UUID, user=Depends(current_user), db: Session = Depends(get_db)):
    return present(accessible(db, bulletin_id, user))


@router.put('/bo/{bulletin_id}')
def update(bulletin_id: uuid.UUID, data: UpdateBulletin, tasks: BackgroundTasks, user=Depends(current_user), db: Session = Depends(get_db)):
    b = accessible(db, bulletin_id, user, lock=True)
    if b.status != 'DRAFT':
        raise HTTPException(409, 'Boletim emitido não pode ser alterado')
    if b.version != data.version:
        raise HTTPException(409, 'Este rascunho foi alterado em outro dispositivo. Atualize a página.')
    assign(db, b, data.data)
    audit(db, user.id, 'BO_UPDATED', b.id)
    if data.emit:
        emit(db, b, data.data, user.id)
    save(db)
    if data.emit:
        tasks.add_task(deliver, b.id, user.id)
    return present(b)


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
    if target.id == user.id and (data.active is False or data.role == 'OPERADOR'):
        raise HTTPException(409, 'Não é permitido remover o próprio acesso administrativo')
    if target.role == 'ADMIN' and target.active and (data.active is False or data.role == 'OPERADOR'):
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
             'action': a.action, 'result': a.result, 'created_at': a.created_at}
            for a, actor in db.execute(select(AuditLog, User).outerjoin(User, AuditLog.user_id == User.id)
                                      .order_by(AuditLog.created_at.desc()).offset((page-1)*50).limit(50))]
