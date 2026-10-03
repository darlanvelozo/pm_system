from app.models.entities import AuditLog, User
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError


def audit(db, user_id, action, bulletin_id=None, result='SUCCESS', report_id=None, details=None):
    try:
        db.flush()
    except (IntegrityError, StaleDataError):
        db.rollback()
        raise HTTPException(409, 'Registro duplicado ou alterado por outra sessão.') from None
    actor = db.get(User, user_id) if user_id else None
    db.add(AuditLog(user_id=user_id, action=action, bulletin_id=bulletin_id, report_id=report_id, result=result, details=details,
                   actor_name_snapshot=actor.name if actor else None,
                   actor_username_snapshot=(actor.username or actor.email) if actor else None))
