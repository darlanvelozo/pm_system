from sqlalchemy import select
from app.auth.security import hasher, verify
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import User

DEFAULT_USERNAME = '24bpmcoroata'


def ensure_default_user():
    cfg = settings()
    if not cfg.single_user_mode:
        return
    password = cfg.single_user_password.get_secret_value()
    if len(password) < 10 or len(password) > 128:
        raise RuntimeError('Configure SINGLE_USER_PASSWORD com 10 a 128 caracteres no ambiente do backend.')
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == DEFAULT_USERNAME))
        if user is None:
            user = User(username=DEFAULT_USERNAME, name='24º BPM Coroatá', role='ADMIN',
                        password_hash=hasher.hash(password), active=True)
            db.add(user)
        else:
            if not verify(password, user.password_hash):
                user.password_hash = hasher.hash(password)
            user.active = True
            user.role = 'ADMIN'
        db.commit()
