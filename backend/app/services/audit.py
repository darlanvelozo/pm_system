from app.models.entities import AuditLog
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError


def audit(db, user_id, action, bulletin_id=None, result='SUCCESS'):
    try:
        db.flush()
    except (IntegrityError, StaleDataError):
        db.rollback()
        raise HTTPException(409, 'Registro duplicado ou alterado por outra sessão.') from None
    db.add(AuditLog(user_id=user_id, action=action, bulletin_id=bulletin_id, result=result))
