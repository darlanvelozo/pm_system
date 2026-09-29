import uuid
from io import BytesIO
from pypdf import PdfReader


def test_author_and_admin_cancellation(client, accounts, payload):
    operator = accounts['operator']['headers']
    admin = accounts['admin']['headers']
    created = client.post('/api/bo', json={'data': payload, 'emit': True}, headers={**operator, 'Idempotency-Key': str(uuid.uuid4())})
    assert created.status_code == 201
    record = created.json()
    assert record['created_by_name'] == 'operator'
    path = '/api/bo/' + record['id']
    pdf = client.get(path + '/pdf', headers=admin)
    assert 'operator' in ''.join(page.extract_text() for page in PdfReader(BytesIO(pdf.content)).pages)
    assert client.get('/api/bo', headers=admin).json()['items'][0]['created_by_name'] == 'operator'
    assert client.post(path + '/cancel', json={'reason': 'Teste'}, headers=operator).status_code == 403
    assert client.post(path + '/cancel', json={'reason': '   '}, headers=admin).status_code == 422
    cancelled = client.post(path + '/cancel', json={'reason': 'Registro duplicado'}, headers=admin)
    assert cancelled.status_code == 200
    assert cancelled.json()['status'] == 'CANCELLED'
    assert cancelled.json()['cancelled_by'] == str(accounts['admin']['user'].id)
    assert client.get(path, headers=operator).json()['cancellation_reason'] == 'Registro duplicado'
    assert client.get(path + '/pdf', headers=admin).status_code == 409
    assert client.post(path + '/resend-email', json={'target': 'both'}, headers=admin).status_code == 409
    assert client.post(path + '/cancel', json={'reason': 'Teste'}, headers=admin).status_code == 409
