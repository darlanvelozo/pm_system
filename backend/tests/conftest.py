import os
import tempfile
from pathlib import Path
import pytest
os.environ['SINGLE_USER_MODE'] = 'false'

os.environ['DATABASE_URL'] = os.environ.get('TEST_DATABASE_URL', 'sqlite:///' + str(Path(tempfile.gettempdir()) / 'bo24-tests.sqlite').replace('\\', '/'))
os.environ.setdefault('JWT_SECRET', 'test-only-secret-not-for-production-1234567890')
os.environ['BATTALION_EMAIL'] = 'boletimonline24bpm@gmail.com'

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import event  # noqa: E402
from app.db.session import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.entities import User  # noqa: E402
from app.auth.security import hasher, token_for  # noqa: E402

if engine.dialect.name == 'sqlite':
    @event.listens_for(engine, 'connect')
    def foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')


@pytest.fixture(autouse=True)
def database(monkeypatch):
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    app.middleware_stack = None
    monkeypatch.setattr('app.services.bulletins.send_bulletin_pdf', lambda *args: True)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture
def accounts():
    with SessionLocal() as db:
        users = [User(email=f'{name}@example.com', name=name, role=role, password_hash=hasher.hash('Fictional-password-123')) for name,role in [('admin','ADMIN'),('operator','OPERADOR'),('other','OPERADOR')]]
        db.add_all(users)
        db.commit()
        return {u.name: {'user': u, 'headers': {'Authorization': f'Bearer {token_for(u)}'}} for u in users}


@pytest.fixture
def payload():
    from app.schemas.bulletin import BulletinInput
    return BulletinInput.model_validate({
        'bulletin_type': 'TWO_INVOLVED', 'recipient_email': 'recipient@example.com', 'bo_number': 'TEST-001',
        'occurrence_type': 'OCORRÊNCIA FICTÍCIA', 'occurrence_date': '2026-01-01', 'occurrence_time': '12:30',
        'location': {'street': 'Rua de Teste', 'city': 'Cidade Fictícia'},
        'people': [{'name': 'Pessoa Fictícia A', 'role': 'Comunicante'}, {}],
        'history': 'Relato fictício para validação de software. Sem ocorrência real.', 'team': [{}, {}],
    }).model_dump(mode='json')
