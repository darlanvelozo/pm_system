import copy
from io import BytesIO
from unittest.mock import MagicMock
import pytest
from pypdf import PdfReader
from sqlalchemy import func, select
from app.db.session import SessionLocal
from app.models.entities import AuditLog, Bulletin, User
from app.schemas.bulletin import BulletinInput
from app.pdf.generator import generate_pdf


def create(client, accounts, payload, emit=True):
    return client.post('/api/bo', headers=accounts['operator']['headers'], json={'data': payload, 'emit': emit})


def test_health_login_and_protected_routes(client, accounts):
    assert client.get('/health').json() == {'status': 'ok'}
    assert client.get('/api/bo').status_code == 401
    assert client.get('/api/bo', headers={'Authorization': 'Bearer nonsense'}).status_code == 401
    assert client.post('/api/auth/login', json={'email': 'operator@example.com', 'password': 'wrong'}).status_code == 401
    r = client.post('/api/auth/login', json={'email': 'operator@example.com', 'password': 'Fictional-password-123'})
    assert r.status_code == 200
    assert 'password_hash' not in r.text
    assert client.get('/api/auth/me', headers={'Authorization': 'Bearer ' + r.json()['access_token']}).status_code == 200


@pytest.mark.parametrize('kind,count', [('TWO_INVOLVED',2), ('FOUR_INVOLVED',4)])
def test_issue_persist_download_email_and_audit(client, accounts, payload, monkeypatch, kind, count):
    calls = []
    monkeypatch.setattr('app.services.bulletins.send_bulletin_pdf', lambda recipient, bo, pdf: calls.append((recipient, bo.id, pdf)) or True)
    payload['bulletin_type'] = kind
    payload['people'] = [{} for _ in range(count)]
    payload['battalionEmail'] = 'untrusted@example.com'
    response = create(client, accounts, payload)
    assert response.status_code == 201, response.text
    bid = response.json()['id']
    data = client.get(f'/api/bo/{bid}', headers=accounts['operator']['headers']).json()
    assert data['status'] == 'ISSUED'
    assert data['battalion_email_status'] == data['recipient_email_status'] == 'SENT'
    assert data['recipient_email_sent_at']
    assert len(data['data']['people']) == count
    assert [c[0] for c in calls] == ['boletimonline24bpm@gmail.com', 'recipient@example.com']
    assert calls[0][2] == calls[1][2]
    pdf = client.get(f'/api/bo/{bid}/pdf', headers=accounts['operator']['headers'])
    assert pdf.status_code == 200
    reader = PdfReader(BytesIO(pdf.content))
    assert len(reader.pages) == 2
    text = '\n'.join(p.extract_text() for p in reader.pages)
    assert 'Relato fictício' in text and 'UNIDADE DE ENTREGA' in text
    assert ('Vestimentas' in text) is (count == 2)
    assert client.get(f'/api/bo/{bid}', headers=accounts['other']['headers']).status_code == 404
    assert client.get(f'/api/bo/{bid}/pdf', headers=accounts['other']['headers']).status_code == 404
    assert client.get(f'/api/bo/{bid}', headers=accounts['admin']['headers']).status_code == 200
    assert client.get('/api/bo', headers=accounts['other']['headers']).json()['total'] == 0
    assert 'history' not in client.get('/api/bo', headers=accounts['operator']['headers']).text
    with SessionLocal() as db:
        actions = set(db.scalars(select(AuditLog.action)))
    assert {'BO_CREATED', 'PDF_GENERATED', 'PDF_DOWNLOADED', 'EMAIL_TO_BATTALION_SENT', 'EMAIL_TO_RECIPIENT_SENT'} <= actions


def test_smtp_failure_and_resend_reuse_pdf(client, accounts, payload, monkeypatch):
    monkeypatch.setattr('app.services.bulletins.send_bulletin_pdf', lambda recipient, *args: recipient == 'boletimonline24bpm@gmail.com')
    r = create(client, accounts, payload)
    bid = r.json()['id']
    headers = accounts['admin']['headers']
    before = client.get(f'/api/bo/{bid}/pdf', headers=headers).content
    data = client.get(f'/api/bo/{bid}', headers=headers).json()
    assert data['recipient_email_status'] == 'FAILED'
    assert data['battalion_email_status'] == 'SENT'
    assert client.post(f'/api/bo/{bid}/resend-email', headers=accounts['operator']['headers'], json={'target':'both'}).status_code == 403
    calls = []
    monkeypatch.setattr('app.services.bulletins.send_bulletin_pdf', lambda recipient, bo, pdf: calls.append((recipient,pdf)) or True)
    assert client.post(f'/api/bo/{bid}/resend-email', headers=headers, json={'target':'recipient'}).status_code == 202
    assert calls == [('recipient@example.com', before)]
    assert client.get(f'/api/bo/{bid}', headers=headers).json()['recipient_email_status'] == 'SENT'
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Bulletin)) == 1


def test_validation_profiles_and_no_sensitive_echo(client, accounts, payload):
    bad = copy.deepcopy(payload)
    bad['recipient_email'] = 'invalid-address-sensitive'
    r = create(client, accounts, bad)
    assert r.status_code == 422 and 'invalid-address-sensitive' not in r.text
    bad = copy.deepcopy(payload)
    bad['bulletin_type'] = 'FOUR_INVOLVED'
    assert create(client, accounts, bad).status_code == 422
    bad['people'] = [{'extras': {'clothing': 'teste'}}, {}, {}, {}]
    assert create(client, accounts, bad).status_code == 422
    payload['people'][0]['extras'] = {'clothing': 'Vestuário fictício', 'firearm': {'selected': True, 'type': 'Teste'}}
    assert create(client, accounts, payload).status_code == 201
    assert create(client, accounts, payload).status_code == 409


def test_draft_update_issue_and_immutability(client, accounts, payload):
    r = create(client, accounts, payload, False).json()
    bid = r['id']
    headers = accounts['operator']['headers']
    assert r['status'] == 'DRAFT'
    assert client.get(f'/api/bo/{bid}/pdf', headers=headers).status_code == 409
    payload['history'] = 'Histórico atualizado de teste.'
    updated = client.put(f'/api/bo/{bid}', headers=headers, json={'data':payload,'version':r['version'],'emit':False})
    assert updated.status_code == 200, updated.text
    assert client.put(f'/api/bo/{bid}', headers=headers, json={'data':payload,'version':r['version'],'emit':True}).status_code == 409
    issued = client.put(f'/api/bo/{bid}', headers=headers, json={'data':payload,'version':updated.json()['version'],'emit':True})
    assert issued.status_code == 200
    assert client.put(f'/api/bo/{bid}', headers=headers, json={'data':payload,'version':issued.json()['version'],'emit':False}).status_code == 409


@pytest.mark.parametrize('kind,count', [('TWO_INVOLVED',2),('FOUR_INVOLVED',4)])
def test_long_pdf_never_truncates(payload, kind, count):
    payload['bulletin_type'] = kind
    payload['people'] = [{} for _ in range(count)]
    payload['history'] = ('Narrativa fictícia extensa com acentuação.\n' * 500) + 'MARCADOR FINAL HISTÓRICO'
    payload['seized_material'] = 'Material fictício.\n' * 500 + 'MARCADOR FINAL MATERIAL'
    pdf = PdfReader(BytesIO(generate_pdf(BulletinInput.model_validate(payload))))
    text = '\n'.join(p.extract_text() for p in pdf.pages)
    assert len(pdf.pages) > 2
    assert 'MARCADOR FINAL HISTÓRICO' in text and 'MARCADOR FINAL MATERIAL' in text
    assert 'UNIDADE DE ENTREGA' in text


def test_admin_and_disabled_user(client, accounts):
    h = accounts['admin']['headers']
    assert client.get('/api/admin/users', headers=accounts['operator']['headers']).status_code == 403
    r = client.post('/api/admin/users', headers=h, json={'email':'new@example.com','name':'Usuário fictício','password':'Fictional-long-pass-2026'})
    assert r.status_code == 201
    uid = accounts['operator']['user'].id
    assert client.patch(f'/api/admin/users/{uid}', headers=h, json={'active':False}).status_code == 200
    assert client.get('/api/auth/me', headers=accounts['operator']['headers']).status_code == 401
    with SessionLocal() as db:
        assert db.get(User, uid).password_hash.startswith('$argon2')


def test_body_limit_rate_limit_and_cors(client):
    assert client.post('/api/auth/login', content='x' * 270000).status_code == 413
    for _ in range(9):
        client.post('/api/auth/login', json={})
    assert client.post('/api/auth/login', json={}).status_code == 429
    r = client.options('/api/bo', headers={'Origin':'http://localhost:3000','Access-Control-Request-Method':'POST'})
    assert r.headers['access-control-allow-origin'] == 'http://localhost:3000'
    assert 'access-control-allow-origin' not in client.options('/api/bo', headers={'Origin':'https://untrusted.example','Access-Control-Request-Method':'POST'}).headers


def test_email_service_mocked_smtp(payload, monkeypatch):
    from app.services.email_service import send_bulletin_pdf
    from app.core.config import settings
    from types import SimpleNamespace
    cfg = settings()
    monkeypatch.setattr(cfg, 'smtp_host', 'smtp.example.com')
    monkeypatch.setattr(cfg, 'smtp_from', 'sender@example.com')
    mock = MagicMock()
    monkeypatch.setattr('app.services.email_service.smtplib.SMTP', mock)
    b = SimpleNamespace(bo_number='TEST/001', data=payload)
    assert send_bulletin_pdf('recipient@example.com', b, b'%PDF-fictional')
    smtp = mock.return_value.__enter__.return_value
    smtp.starttls.assert_called_once()
    message = smtp.send_message.call_args.args[0]
    assert message['To'] == 'recipient@example.com' and message['Cc'] is None
    assert next(message.iter_attachments()).get_filename() == 'BO_TEST_001.pdf'
    mock.side_effect = OSError('Fictional SMTP failure')
    assert not send_bulletin_pdf('recipient@example.com', b, b'%PDF-fictional')
