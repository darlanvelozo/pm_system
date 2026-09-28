"""Local-only browser test account. Requires an explicitly named disposable database."""
import os
from sqlalchemy import select
from app.auth.security import hasher
from app.db.session import SessionLocal
from app.models.entities import User

if __name__ == '__main__':
    if not os.environ.get('DATABASE_URL', '').endswith('/bo_e2e'):
        raise SystemExit('Use somente o banco descartável bo_e2e')
    with SessionLocal() as db:
        if not db.scalar(select(User).where(User.email == 'e2e@example.com')):
            db.add(User(email='e2e@example.com', name='Operador de teste', role='ADMIN', password_hash=hasher.hash('Fictional-e2e-password-2026')))
            db.commit()
