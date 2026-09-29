import pytest
from pydantic import SecretStr
from sqlalchemy import select, func
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import User
from app.services.default_user import ensure_default_user
from app.auth.security import verify


def test_single_account(client, accounts, monkeypatch):
    cfg = settings()
    monkeypatch.setattr(cfg, 'single_user_mode', True)
    monkeypatch.setattr(cfg, 'single_user_password', SecretStr('fictional-password'))
    ensure_default_user()
    ensure_default_user()
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(User).where(User.username == '24bpmcoroata')) == 1
        user = db.scalar(select(User).where(User.username == '24bpmcoroata'))
        assert verify('fictional-password', user.password_hash)
    login = client.post('/api/auth/login', json={'username': '24bpmcoroata', 'password': 'fictional-password'})
    assert login.status_code == 200
    headers = {'Authorization': 'Bearer ' + login.json()['access_token']}
    assert client.get('/api/auth/me', headers=accounts['admin']['headers']).status_code == 200
    assert client.post('/api/admin/users', headers=headers, json={
        'username': 'blocked', 'name': 'Test', 'password': 'fictional-password'}).status_code == 201
    assert client.patch('/api/admin/users/' + login.json()['user']['id'], headers=headers,
                        json={'active': False}).status_code == 409
    assert client.post('/api/auth/login', json={'email': 'admin@example.com',
                       'password': 'Fictional-password-123'}).status_code == 200
    monkeypatch.setattr(cfg, 'single_user_password', SecretStr('different-password'))
    ensure_default_user()
    assert client.post('/api/auth/login', json={'username': '24bpmcoroata', 'password': 'fictional-password'}).status_code == 401


def test_default_account_requires_secret(monkeypatch):
    monkeypatch.setattr(settings(), 'single_user_mode', True)
    monkeypatch.setattr(settings(), 'single_user_password', SecretStr(''))
    with pytest.raises(RuntimeError, match='SINGLE_USER_PASSWORD'):
        ensure_default_user()
