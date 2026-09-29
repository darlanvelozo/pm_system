from sqlalchemy import select
from app.auth.security import hasher
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import User

DEFAULT_USERNAME = '24bpmcoroata'


def ensure_default_user():
    cfg = settings()
    if not cfg.single_user_mode:
        return
    with SessionLocal() as db:
        # Bootstrap only: never undo profile/password changes made by administrators.
        if db.scalar(select(User.id).where(User.role == 'ADMIN', User.active.is_(True))):
            return
        if db.scalar(select(User.id).where(User.username == DEFAULT_USERNAME)):
            return
        password = cfg.single_user_password.get_secret_value()
        if len(password) < 10 or len(password) > 128:
            raise RuntimeError('Configure SINGLE_USER_PASSWORD com 10 a 128 caracteres para criar o administrador inicial.')
        db.add(User(username=DEFAULT_USERNAME, name='Administrador inicial', role='ADMIN',
                    password_hash=hasher.hash(password), active=True))
        db.commit()
