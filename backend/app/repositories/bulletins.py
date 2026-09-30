from fastapi import HTTPException
import uuid
from sqlalchemy import select
from app.models.entities import Bulletin, PersonInvolved, PoliceTeam


def accessible(db, bulletin_id, user, lock=False):
    query = select(Bulletin).where(Bulletin.id == bulletin_id)
    if user.role != 'ADMIN':
        query = query.where(Bulletin.created_by == user.id, Bulletin.status != 'REMOVED')
    if lock:
        query = query.with_for_update()
    bulletin = db.scalar(query)
    if not bulletin:
        raise HTTPException(404, 'Boletim não encontrado')
    if user.role == 'GERADOR' and bulletin.status != 'DRAFT':
        raise HTTPException(403, 'Acesso permitido somente ao rascunho ativo.')
    return bulletin


def assign(db, bulletin, data):
    payload = data.model_dump(mode='json')
    payload['bo_number'] = bulletin.bo_number
    bulletin.bulletin_type = data.bulletin_type.value
    bulletin.recipient_email = str(data.recipient_email)
    people = payload.pop('people')
    old = {str(p.id): p for p in bulletin.people}
    ids = [p['id'] for p in people if p.get('id')]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, 'Identidade de envolvido duplicada')
    # Stage positions away from final indexes before deleting/reordering rows.
    for index, person in enumerate(bulletin.people):
        person.position = -index-1
    if old:
        db.flush()
    updated = []
    for index, value in enumerate(people):
        pid = value.pop('id', None)
        person = old.get(pid)
        if person is None:
            if pid and db.get(PersonInvolved, uuid.UUID(pid)):
                raise HTTPException(422, 'Envolvido pertence a outro boletim')
            person = PersonInvolved(id=uuid.UUID(pid) if pid else uuid.uuid4(), position=index, data=value)
        else:
            person.position = index
            person.data = value
        updated.append(person)
    bulletin.people = updated
    bulletin.team = [PoliceTeam(position=i, data=t) for i,t in enumerate(payload.pop('team'))]
    bulletin.data = payload


def present(b):
    return {
        'id': str(b.id), 'created_by': str(b.created_by), 'bo_number': b.bo_number,
        'created_by_name': b.registered_by_name_snapshot or b.creator.name, 'created_by_username': b.registered_by_username_snapshot or b.creator.username or b.creator.email,
        'current_revision': b.current_revision, 'edited_at': b.edited_at, 'edit_reason': b.edit_reason,
        'deleted_at': b.deleted_at, 'deletion_reason': b.deletion_reason,
        **(b.lifecycle or {}),
        'cancelled_at': b.cancelled_at, 'cancelled_by': str(b.cancelled_by) if b.cancelled_by else None,
        'cancellation_reason': b.cancellation_reason,
        'bulletin_type': b.bulletin_type, 'recipient_email': b.recipient_email,
        'status': b.status, 'version': b.version,
        'data': {**b.data, 'bo_number': b.bo_number, 'people': [{**p.data, 'id': str(p.id)} for p in b.people], 'team': [t.data for t in b.team]},
        'pdf_generated_at': b.pdf_generated_at, 'recipient_email_status': b.recipient_email_status,
        'battalion_email_status': b.battalion_email_status,
        'recipient_email_sent_at': b.recipient_email_sent_at, 'battalion_email_sent_at': b.battalion_email_sent_at,
        'created_at': b.created_at, 'updated_at': b.updated_at,
    }
