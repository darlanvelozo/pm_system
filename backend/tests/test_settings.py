import re
import uuid
from io import BytesIO
import pytest
from pypdf import PdfReader
from sqlalchemy import select
from app.api import settings as settings_api
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.entities import AuditLog

REPORT = {'recipient_email': 'fictional@example.com', 'occurrence_type': 'TESTE FICTÍCIO', 'location': 'Local fictício',
          'occurrence_date': '2026-09-30', 'occurrence_time': '12:30', 'fled': 'NÃO', 'samu': 'NÃO', 'icrim': 'NÃO',
          'narrative': 'Relato fictício.', 'measures': 'Providências fictícias.', 'closing_location': 'Cidade Fictícia',
          'closing_date': '2026-09-30'}
CUSTOM = {'unit_name': 'Batalhão Fictício de Teste', 'unit_short_name': 'BPM Fictício', 'unit_city': 'Cidade Fictícia/UF',
          'battalion_email': 'batalhao@example.com', 'reply_to_email': 'respostas@example.com',
          'signatory_name': 'Autoridade Fictícia', 'signatory_rank': 'CEL PM', 'signatory_title': 'Comandante Fictício'}


@pytest.fixture(autouse=True)
def reset_limits():
    settings_api.test_hits.clear()


def text_of(content):
    return ' '.join(' '.join(p.extract_text() for p in PdfReader(BytesIO(content)).pages).split())


def emit_bo(client, headers, payload):
    response = client.post('/api/bo', headers={**headers, 'Idempotency-Key': str(uuid.uuid4())}, json={'data': payload, 'emit': True})
    assert response.status_code == 201, response.text
    return response.json()


def emit_report(client, headers):
    r = client.post('/api/analytical-reports', headers=headers, json={'data': REPORT}).json()
    response = client.post(f'/api/analytical-reports/{r["id"]}/emit', headers={**headers, 'Idempotency-Key': str(uuid.uuid4())}, json={'version': r['version']})
    assert response.status_code == 200, response.text
    return response.json()


def test_settings_admin_only(client, accounts):
    h = accounts['operator']['headers']
    assert client.get('/api/admin/settings', headers=h).status_code == 403
    assert client.put('/api/admin/settings', headers=h, json=CUSTOM).status_code == 403
    assert client.get('/api/admin/diagnostics', headers=h).status_code == 403
    assert client.post('/api/admin/diagnostics/test-email', headers=h, json={'email': 'a@example.com'}).status_code == 403
    assert client.get('/api/admin/settings').status_code == 401
    assert client.get('/api/admin/settings', headers=accounts['admin']['headers']).status_code == 200


@pytest.mark.parametrize('change', [{'battalion_email': 'invalido'}, {'reply_to_email': 'a@'}, {'unit_name': 'x' * 151},
                                    {'unit_short_name': 'x' * 61}, {'signatory_name': 'Nome\nquebrado'}, {'unit_city': '<b>'},
                                    {'unknown': 'value'}])
def test_settings_validation(client, accounts, change):
    assert client.put('/api/admin/settings', headers=accounts['admin']['headers'], json={**CUSTOM, **change}).status_code == 422


def test_fallback_to_environment_and_audit(client, accounts, monkeypatch):
    admin = accounts['admin']['headers']
    monkeypatch.setattr(settings(), 'report_signatory_name', 'Autoridade do Ambiente')
    initial = client.get('/api/admin/settings', headers=admin).json()
    assert all(v is None for v in initial['values'].values())
    assert initial['effective'] == initial['defaults']
    assert initial['defaults']['unit_short_name'] == '24º BPM' and initial['defaults']['signatory_name'] == 'Autoridade do Ambiente'
    assert initial['defaults']['battalion_email'] == 'boletimonline24bpm@gmail.com'
    saved = client.put('/api/admin/settings', headers=admin, json={'unit_short_name': '  BPM Fictício  ', 'battalion_email': ''}).json()
    assert saved['changed'] == ['unit_short_name'] and saved['values']['unit_short_name'] == 'BPM Fictício'
    assert saved['effective']['battalion_email'] == 'boletimonline24bpm@gmail.com' and saved['updated_by_name'] == 'admin'
    cleared = client.put('/api/admin/settings', headers=admin, json={'unit_short_name': ''}).json()
    assert cleared['values']['unit_short_name'] is None and cleared['effective']['unit_short_name'] == '24º BPM'
    assert client.put('/api/admin/settings', headers=admin, json={}).json()['changed'] == []
    with SessionLocal() as db:
        logs = db.scalars(select(AuditLog).where(AuditLog.action == 'SETTINGS_UPDATED')).all()
    assert [log.details for log in logs] == [{'fields': ['unit_short_name']}] * 2
    events = client.get('/api/admin/audit', headers=admin).json()
    assert 'BPM Fictício' not in str(events) and any(e['details'] == {'fields': ['unit_short_name']} for e in events)


def test_defaults_reproduce_previous_pdf_output(client, accounts, payload):
    h = accounts['operator']['headers']
    bo = text_of(client.post('/api/bo/preview-pdf', headers=h, json=payload).content)
    # The bullet separator is extracted as an arbitrary glyph.
    assert re.search(r'24º BPM \S Página 1', bo)
    report = client.post('/api/analytical-reports/preview-pdf', headers=h, json=REPORT)
    assert '24º Batalhão de Polícia Militar · Coroatá/MA' in text_of(report.content)
    assert PdfReader(BytesIO(report.content)).metadata.author == '24º BPM'


def test_pdfs_and_battalion_email_use_database_values(client, accounts, payload, monkeypatch):
    bo_mail, report_mail = [], []
    monkeypatch.setattr('app.services.bulletins.send_bulletin_pdf', lambda recipient, bo, pdf, options: bo_mail.append((recipient, options)) or True)
    monkeypatch.setattr('app.services.analytical_reports.send_document_pdf', lambda *args: report_mail.append(args) or True)
    assert client.put('/api/admin/settings', headers=accounts['admin']['headers'], json=CUSTOM).status_code == 200
    h = accounts['operator']['headers']
    bo = emit_bo(client, h, payload)
    content = client.get(f'/api/bo/{bo["id"]}/pdf', headers=h).content
    assert re.search(r'BPM Fictício \S Página 1', text_of(content)) and '24º BPM' not in text_of(content)
    assert PdfReader(BytesIO(content)).metadata.author == 'BPM Fictício'
    assert ('batalhao@example.com', {'unit_short': 'BPM Fictício', 'reply_to': 'respostas@example.com'}) in bo_mail
    assert 'boletimonline24bpm@gmail.com' not in [r for r, _ in bo_mail]
    report = emit_report(client, h)
    text = text_of(client.get(f'/api/analytical-reports/{report["id"]}/pdf', headers=h).content)
    assert 'Batalhão Fictício de Teste · Cidade Fictícia/UF' in text and 'CEL PM Autoridade Fictícia' in text and 'Comandante Fictício' in text
    recipients = [args[0] for args in report_mail]
    assert 'batalhao@example.com' in recipients and 'boletimonline24bpm@gmail.com' not in recipients
    assert all(args[-1] == 'respostas@example.com' and 'BO Online BPM Fictício' in args[3] for args in report_mail)


def test_email_texts_use_unit_short_name(payload):
    from types import SimpleNamespace
    from app.services.email_summary import email_summary
    bulletin = SimpleNamespace(bo_number='TEST/001', data=payload, current_revision=1, people=[], registered_by_name_snapshot='A', registered_by_username_snapshot='a')
    assert email_summary(bulletin)[1].endswith('BO Online 24º BPM.\n\nAtenciosamente,\n24º BPM')
    assert email_summary(bulletin, 'BPM Fictício')[1].endswith('BO Online BPM Fictício.\n\nAtenciosamente,\nBPM Fictício')


def test_diagnostics_never_leak_secrets(client, accounts, monkeypatch):
    cfg = settings()
    secrets = {'brevo_api_key': 'brevo-secret-value-123', 'smtp_password': 'smtp-secret-value-456', 'gmail_client_secret': 'gmail-secret-789',
               'gmail_refresh_token': 'refresh-secret-000', 'jwt_secret': cfg.jwt_secret}
    for key, value in secrets.items():
        monkeypatch.setattr(cfg, key, value)
    monkeypatch.setattr(cfg, 'email_provider', 'brevo')
    response = client.get('/api/admin/diagnostics', headers=accounts['admin']['headers'])
    assert response.status_code == 200
    body = response.text
    assert not any(value in body for value in secrets.values()) and cfg.database_url not in body
    data = response.json()
    assert data['email']['provider'] == 'brevo' and data['email']['credentials_configured'] is True
    assert data['email']['sender_configured'] is (bool(cfg.brevo_from))
    assert data['database']['reachable'] is True and data['database']['head'] == '20261002_settings'
    assert data['app']['bo_pdf_layout'] and data['frontend_url'] == cfg.frontend_url


def test_test_email_honest_result_audit_and_rate_limit(client, accounts, monkeypatch):
    admin = accounts['admin']['headers']
    cfg = settings()
    monkeypatch.setattr(cfg, 'email_provider', 'smtp')
    monkeypatch.setattr(cfg, 'smtp_host', '')
    sent = []
    monkeypatch.setattr(settings_api, 'send_message', lambda *args, **kwargs: sent.append((args, kwargs)) or True)
    failed = client.post('/api/admin/diagnostics/test-email', headers=admin, json={'email': 'destino@example.com'}).json()
    assert failed['sent'] is False and 'não está configurado' in failed['message'] and not sent
    monkeypatch.setattr(cfg, 'smtp_host', 'smtp.example.com')
    monkeypatch.setattr(cfg, 'smtp_from', 'remetente@example.com')
    ok = client.post('/api/admin/diagnostics/test-email', headers=admin, json={'email': 'destino@example.com'}).json()
    assert ok['sent'] is True and 'Aceitação não garante entrega' in ok['message'] and sent[0][0][0] == 'destino@example.com'
    monkeypatch.setattr(settings_api, 'send_message', lambda *args, **kwargs: False)
    refused = client.post('/api/admin/diagnostics/test-email', headers=admin, json={'email': 'destino@example.com'}).json()
    assert refused['sent'] is False and 'recusou' in refused['message']
    limited = client.post('/api/admin/diagnostics/test-email', headers=admin, json={'email': 'destino@example.com'})
    assert limited.status_code == 429
    assert client.post('/api/admin/diagnostics/test-email', headers=admin, json={'email': 'invalido'}).status_code == 422
    with SessionLocal() as db:
        actions = [a.action for a in db.scalars(select(AuditLog).where(AuditLog.action.like('SETTINGS_TEST_EMAIL_%')).order_by(AuditLog.created_at))]
    assert actions == ['SETTINGS_TEST_EMAIL_FAILED', 'SETTINGS_TEST_EMAIL_SENT', 'SETTINGS_TEST_EMAIL_FAILED']


def test_reply_to_header_for_smtp_only_when_set(monkeypatch):
    from app.services import email_service
    cfg = settings()
    for key, value in {'email_provider': 'smtp', 'smtp_host': 'smtp.example.com', 'smtp_from': 'remetente@example.com', 'smtp_username': ''}.items():
        monkeypatch.setattr(cfg, key, value)
    messages = []

    class Server:
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def starttls(self, **kwargs): pass
        def send_message(self, message): messages.append(message)
    monkeypatch.setattr(email_service.smtplib, 'SMTP', Server)
    assert email_service.send_message('a@example.com', 'Assunto', 'Corpo')
    assert email_service.send_message('a@example.com', 'Assunto', 'Corpo', reply_to='respostas@example.com')
    assert messages[0]['Reply-To'] is None and messages[1]['Reply-To'] == 'respostas@example.com'
