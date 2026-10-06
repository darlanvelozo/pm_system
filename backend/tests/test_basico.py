import uuid
import pytest

RECEIPT_BO = {'id', 'bo_number', 'status', 'current_revision', 'pdf_generated_at'}
RECEIPT_REPORT = {'id', 'report_number', 'status', 'current_revision', 'pdf_generated_at'}


@pytest.fixture(autouse=True)
def no_real_mail(monkeypatch):
    monkeypatch.setattr('app.services.analytical_reports.send_document_pdf', lambda *args: True)


@pytest.fixture
def basico(client, accounts):
    admin = accounts['admin']['headers']
    created = client.post('/api/admin/users', headers=admin, json={'username': 'basico.teste', 'name': 'Básico Fictício',
                          'password': 'Fictional-basic-123', 'role': 'BASICO'})
    assert created.status_code == 201, created.text
    login = client.post('/api/auth/login', json={'username': 'basico.teste', 'password': 'Fictional-basic-123'})
    assert login.json()['user']['role'] == 'BASICO'
    return {'id': created.json()['id'], 'headers': {'Authorization': 'Bearer ' + login.json()['access_token']}}


@pytest.fixture
def report_payload():
    return {'recipient_email': 'fictional@example.com', 'occurrence_type': 'ROUBO FICTÍCIO', 'location': 'Rua de teste',
            'occurrence_date': '2026-09-30', 'occurrence_time': '12:30', 'fled': 'NÃO', 'samu': 'SIM', 'icrim': 'NÃO',
            'narrative': 'Narrativa fictícia.', 'measures': 'Providências fictícias.',
            'closing_location': 'Cidade Fictícia', 'closing_date': '2026-09-30'}


def test_basico_bulletin_create_draft_emit_receipt(client, accounts, basico, payload):
    h, admin = basico['headers'], accounts['admin']['headers']
    draft = client.post('/api/bo', headers=h, json={'data': payload}).json()
    path = f'/api/bo/{draft["id"]}'
    assert draft['status'] == 'DRAFT' and 'data' in draft
    assert client.get('/api/bo/active-draft', headers=h).json()['id'] == draft['id']
    assert [b['id'] for b in client.get('/api/bo?status=DRAFT', headers=h).json()['items']] == [draft['id']]
    updated = client.put(path, headers=h, json={'data': payload, 'version': draft['version']}).json()
    assert client.get(path, headers=h).status_code == 200
    assert client.post('/api/bo/preview-pdf', headers=h, json=payload).status_code == 200
    key = str(uuid.uuid4())
    issued = client.post(path + '/emit', headers={**h, 'Idempotency-Key': key}, json={'version': updated['version']})
    assert issued.status_code == 200, issued.text
    assert set(issued.json()) == RECEIPT_BO and issued.json()['status'] == 'ISSUED' and issued.json()['bo_number']
    retry = client.post(path + '/emit', headers={**h, 'Idempotency-Key': key}, json={'version': updated['version']}).json()
    assert set(retry) == RECEIPT_BO and retry['bo_number'] == issued.json()['bo_number']
    for suffix in ('', '/pdf', '/verify?revision=1', '/revisions', '/revisions/1/pdf'):
        assert client.get(path + suffix, headers=h).status_code == 403, suffix
    assert client.put(path, headers=h, json={'data': payload, 'version': updated['version']}).status_code == 403
    assert client.get('/api/bo/active-draft', headers=h).json() is None
    assert client.get('/api/bo?status=DRAFT', headers=h).json()['items'] == []
    # Direct emission (POST with emit) also returns only the receipt; the admin sees the full record.
    direct = client.post('/api/bo', headers={**h, 'Idempotency-Key': str(uuid.uuid4())}, json={'data': payload, 'emit': True})
    assert direct.status_code == 201 and set(direct.json()) == RECEIPT_BO
    assert client.get(f'/api/bo/{direct.json()["id"]}', headers=admin).json()['created_by_name'] == 'Básico Fictício'


def test_basico_cannot_list_or_consult(client, accounts, basico, payload):
    h = basico['headers']
    for path in ('/api/bo', '/api/bo?status=ISSUED', '/api/bo?status=CANCELLED', '/api/operational-options',
                 '/api/analytical-reports', '/api/analytical-reports?status=ISSUED',
                 '/api/admin/users', '/api/admin/audit', '/api/admin/stats', '/api/admin/settings', '/api/admin/diagnostics'):
        assert client.get(path, headers=h).status_code == 403, path
    other = client.post('/api/bo', headers=accounts['operator']['headers'], json={'data': payload}).json()
    assert client.get(f'/api/bo/{other["id"]}', headers=h).status_code == 404
    assert client.post(f'/api/bo/{other["id"]}/cancel', headers=h, json={'reason': 'Teste fictício'}).status_code == 403


def test_basico_report_create_draft_emit_receipt(client, accounts, basico, report_payload):
    h, base = basico['headers'], '/api/analytical-reports'
    draft = client.post(base, headers=h, json={'data': report_payload})
    assert draft.status_code == 201, draft.text
    draft = draft.json()
    path = f'{base}/{draft["id"]}'
    assert [r['id'] for r in client.get(base + '?status=DRAFT', headers=h).json()['items']] == [draft['id']]
    updated = client.put(path, headers=h, json={'data': report_payload, 'version': draft['version']}).json()
    assert client.get(path, headers=h).json()['data']['narrative'] == 'Narrativa fictícia.'
    assert client.post(base + '/preview-pdf', headers=h, json=report_payload).status_code == 200
    key = str(uuid.uuid4())
    issued = client.post(path + '/emit', headers={**h, 'Idempotency-Key': key}, json={'version': updated['version']})
    assert issued.status_code == 200, issued.text
    assert set(issued.json()) == RECEIPT_REPORT and issued.json()['report_number'].endswith('/2026')
    retry = client.post(path + '/emit', headers={**h, 'Idempotency-Key': key}, json={'version': updated['version']}).json()
    assert set(retry) == RECEIPT_REPORT and retry['report_number'] == issued.json()['report_number']
    for suffix in ('', '/pdf', '/revisions', '/revisions/1/pdf'):
        assert client.get(path + suffix, headers=h).status_code == 403, suffix
    assert client.put(path, headers=h, json={'data': report_payload, 'version': updated['version']}).status_code == 403
    for action in ('revise', 'cancel', 'remove', 'resend-email'):
        assert client.post(f'{path}/{action}', headers=h, json={'reason': 'Teste fictício'}).status_code in (403, 422), action
    assert client.get(base + '?status=DRAFT', headers=h).json()['items'] == []
    admin = client.get(path, headers=accounts['admin']['headers']).json()
    assert admin['status'] == 'ISSUED' and admin['data']['narrative'] == 'Narrativa fictícia.'
    other = client.post(base, headers=accounts['operator']['headers'], json={'data': report_payload}).json()
    assert client.get(f'{base}/{other["id"]}', headers=h).status_code == 404


def test_basico_role_management(client, accounts, basico):
    admin = accounts['admin']['headers']
    assert client.patch(f'/api/admin/users/{accounts["admin"]["user"].id}', headers=admin, json={'role': 'BASICO'}).status_code == 409
    assert client.patch(f'/api/admin/users/{basico["id"]}', headers=admin, json={'role': 'OPERADOR'}).json()['role'] == 'OPERADOR'
    assert client.patch(f'/api/admin/users/{basico["id"]}', headers=admin, json={'role': 'BASICO'}).json()['role'] == 'BASICO'
    assert client.patch(f'/api/admin/users/{basico["id"]}', headers=admin, json={'role': 'GERADOR'}).status_code == 422
    # Promoting a second admin, the first one may then be demoted to BASICO.
    assert client.patch(f'/api/admin/users/{accounts["operator"]["user"].id}', headers=admin, json={'role': 'ADMIN'}).status_code == 200
    second = client.post('/api/auth/login', json={'username': 'operator@example.com', 'password': 'Fictional-password-123'}).json()['access_token']
    assert client.patch(f'/api/admin/users/{accounts["admin"]["user"].id}', headers={'Authorization': 'Bearer ' + second},
                        json={'role': 'BASICO'}).json()['role'] == 'BASICO'
