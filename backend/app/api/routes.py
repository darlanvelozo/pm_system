import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError
from app.auth.security import admin, current_user, dummy_hash, hasher, token_for, verify
from app.db.session import get_db
from app.models.entities import AuditLog, Bulletin, User
from app.repositories.bulletins import accessible, assign, present
from app.schemas.bulletin import CreateBulletin, ResendInput, UpdateBulletin
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
    if b.status == 'CANCELLED':
        raise HTTPException(409, 'Boletim já cancelado')
    reason = data.reason.strip()
    if len(reason) < 3:
        raise HTTPException(422, 'Informe o motivo do cancelamento')
    b.status = 'CANCELLED'
    b.cancelled_at = now()
    b.cancelled_by = user.id
    b.cancellation_reason = reason
    audit(db, user.id, 'BO_CANCELLED', b.id)
    save(db)
    return present(b)


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
    assign(bulletin, data.data)
    db.add(bulletin)
    audit(db, user.id, 'BO_CREATED', bulletin.id)
    if data.emit:
        emit(db, bulletin, data.data, user.id)
    save(db)
    if data.emit:
        tasks.add_task(deliver, bulletin.id, user.id)
    return present(bulletin)


@router.get('/bo')
def listing(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), user=Depends(current_user), db: Session = Depends(get_db)):
    query = select(Bulletin)
    if user.role != 'ADMIN':
        query = query.where(Bulletin.created_by == user.id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Bulletin.created_at.desc()).offset((page-1)*size).limit(size)).all()
    # List endpoint intentionally omits personal data and narrative.
    return {'total': total, 'page': page, 'size': size, 'items': [{
        'id': str(b.id), 'bo_number': b.bo_number, 'bulletin_type': b.bulletin_type,
        'created_by': str(b.created_by), 'created_by_name': b.creator.name, 'created_by_username': b.creator.username or b.creator.email, 'status': b.status, 'occurrence_type': b.data['occurrence_type'],
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
        raise HTTPException(409, 'Rascunho alterado. Atualize a página.')
    assign(b, data.data)
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
