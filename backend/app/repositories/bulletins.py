from fastapi import HTTPException
from sqlalchemy import select
from app.models.entities import Bulletin, PersonInvolved, PoliceTeam


def accessible(db, bulletin_id, user, lock=False):
    query = select(Bulletin).where(Bulletin.id == bulletin_id)
    if user.role != 'ADMIN':
        query = query.where(Bulletin.created_by == user.id)
    if lock:
        query = query.with_for_update()
    bulletin = db.scalar(query)
    if not bulletin:
        raise HTTPException(404, 'Boletim não encontrado')
    return bulletin


def assign(bulletin, data):
    payload = data.model_dump(mode='json')
    bulletin.bo_number = data.bo_number
    bulletin.bulletin_type = data.bulletin_type.value
    bulletin.recipient_email = str(data.recipient_email)
    # Reuse existing child rows to preserve positions and avoid unique conflicts.
    people = payload.pop('people')
    for i, person in enumerate(people):
        if i < len(bulletin.people):
            bulletin.people[i].data = person
        else:
            bulletin.people.append(PersonInvolved(position=i, data=person))
    del bulletin.people[len(people):]
    bulletin.team = [PoliceTeam(position=i, data=t) for i,t in enumerate(payload.pop('team'))]
    bulletin.data = payload


def present(b):
    return {
        'id': str(b.id), 'created_by': str(b.created_by), 'bo_number': b.bo_number,
        'bulletin_type': b.bulletin_type, 'recipient_email': b.recipient_email,
        'status': b.status, 'version': b.version,
        'data': {**b.data, 'people': [p.data for p in b.people], 'team': [t.data for t in b.team]},
        'pdf_generated_at': b.pdf_generated_at, 'recipient_email_status': b.recipient_email_status,
        'battalion_email_status': b.battalion_email_status,
        'recipient_email_sent_at': b.recipient_email_sent_at, 'battalion_email_sent_at': b.battalion_email_sent_at,
        'created_at': b.created_at, 'updated_at': b.updated_at,
    }
