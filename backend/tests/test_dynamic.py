import uuid
import hashlib
import copy
import re
from io import BytesIO
import pytest
from pypdf import PdfReader
from app.pdf.layout import position_label


def pdf_text(response):
    assert response.status_code == 200
    return '\n'.join(p.extract_text() for p in PdfReader(BytesIO(response.content)).pages)


def assert_commander_label(text):
    normalized = ' '.join(text.split())
    assert 'Posto/Graduação/Nome Cmt:' in normalized
    assert not re.search(r'\bPosto\s*/\s*Nome\s+(?:Cmt|Comandante)\s*:', normalized, re.IGNORECASE)


@pytest.mark.parametrize('count', [1, 2, 3, 4, 5, 8, 12, 30])
def test_dynamic_pdf(client, accounts, payload, count):
    payload['bulletin_type'] = 'DYNAMIC'
    payload['people'] = [{'name': f'Pessoa Ficticia {i:02d}', 'extras': {'clothing': f'Roupa teste {i:02d}'}} for i in range(count)]
    h = accounts['operator']['headers']
    r = client.post('/api/bo', headers={**h, 'Idempotency-Key': str(uuid.uuid4())}, json={'data': payload, 'emit': True})
    assert r.status_code == 201, r.text
    record = r.json()
    assert len(record['data']['people']) == count
    assert len(set(p['id'] for p in record['data']['people'])) == count
    text = pdf_text(client.get(f'/api/bo/{record["id"]}/pdf', headers=h))
    assert_commander_label(text)
    for i in range(count):
        assert f'Pessoa Ficticia {i:02d}' in text
        assert f'Roupa teste {i:02d}' in text
    assert 'operator (operator@example.com)' in text
    assert position_label(25) == 'Z' and position_label(26) == 'AA' and position_label(29) == 'AD'


def test_revision_growth_shrink_and_soft_removal(client, accounts, payload, monkeypatch):
    calls = []
    monkeypatch.setattr('app.services.bulletins.send_bulletin_pdf', lambda *args: calls.append(args) or True)
    op, admin = accounts['operator']['headers'], accounts['admin']['headers']
    payload['people'] = [{'name': 'Original A'}, {'name': 'Original B'}]
    r = client.post('/api/bo', headers={**op, 'Idempotency-Key': str(uuid.uuid4())}, json={'data': payload, 'emit': True}).json()
    path = '/api/bo/' + r['id']
    old_pdf = client.get(path + '/pdf', headers=admin).content
    r = client.get(path, headers=admin).json()
    original_ids = [p['id'] for p in r['data']['people']]
    data = copy.deepcopy(r['data'])
    data['people'] += [{'name': f'Novo {i}'} for i in range(5)]
    body = {'data': data, 'version': r['version'], 'reason': 'Inclusão de pessoas fictícias'}
    assert client.post(path + '/revise', headers=op, json=body).status_code == 403
    r = client.post(path + '/revise', headers=admin, json=body)
    assert r.status_code == 200, r.text
    r = r.json()
    assert len(calls) == 2  # revisions do not send automatically
    assert r['current_revision'] == 2
    assert r['bo_number'] == body['data']['bo_number']
    previous_hash = client.get(path + '/verify?revision=1', headers=admin).json()['pdf_sha256']
    current_hash = client.get(path + '/verify?revision=2', headers=admin).json()['pdf_sha256']
    assert previous_hash == hashlib.sha256(old_pdf).hexdigest()
    assert previous_hash != current_hash
    assert current_hash == hashlib.sha256(client.get(path + '/pdf', headers=admin).content).hexdigest()
    assert [p['id'] for p in r['data']['people'][:2]] == original_ids
    assert client.get(path + '/revisions/1/pdf', headers=admin).content == old_pdf
    text = pdf_text(client.get(path + '/pdf', headers=admin))
    assert_commander_label(text)
    assert all(f'Novo {i}' in text for i in range(5))
    assert client.post(path + '/revise', headers=admin, json=body).status_code == 409
    data = copy.deepcopy(r['data'])
    retained = data['people'][4:]
    data['people'] = retained
    r = client.post(path + '/revise', headers=admin, json={'data': data, 'version': r['version'], 'reason': 'Remoção de pessoas fictícias'}).json()
    assert r['data']['people'] == retained
    assert r['current_revision'] == 3
    text = pdf_text(client.get(path + '/pdf', headers=admin))
    assert_commander_label(text)
    assert 'Original A' not in text and 'Novo 0' not in text and 'Novo 4' in text
    assert len(client.get(path + '/revisions', headers=admin).json()) == 3
    assert client.post(path + '/remove', headers=admin, json={'reason': 'Teste de remoção'}).status_code == 200
    assert client.get(path, headers=op).status_code == 404
    assert client.get('/api/bo', headers=admin).json()['total'] == 0
    assert client.get('/api/bo?status=REMOVED', headers=admin).json()['total'] == 1
    assert client.get(path + '/revisions/1/pdf', headers=admin).content == old_pdf


def test_partial_draft_and_conflict(client, accounts, payload):
    payload.update(history='', recipient_email='', occurrence_date=None, occurrence_time=None, occurrence_type='')
    payload['location'] = {}
    h = accounts['operator']['headers']
    r = client.post('/api/bo', headers=h, json={'data': payload, 'emit': False})
    assert r.status_code == 201, r.text
    r = r.json()
    url = '/api/bo/' + r['id']
    assert client.put(url, headers={**h, 'Idempotency-Key': str(uuid.uuid4())}, json={'data': payload, 'version': r['version'], 'emit': True}).status_code == 422
    payload['history'] = 'Edição em outro dispositivo'
    assert client.put(url, headers=h, json={'data': payload, 'version': r['version'], 'emit': False}).status_code == 200
    assert client.put(url, headers=h, json={'data': payload, 'version': r['version'], 'emit': False}).status_code == 409


def test_eight_to_three_preserves_identity_and_previous_pdf(client, accounts, payload):
    headers = accounts['admin']['headers']
    payload['people'] = [{'name': f'Fictional person {i}'} for i in range(8)]
    created = client.post('/api/bo', headers={**headers, 'Idempotency-Key': str(uuid.uuid4())}, json={'data': payload, 'emit': True}).json()
    path = '/api/bo/' + created['id']
    current = client.get(path, headers=headers).json()
    old = client.get(path + '/pdf', headers=headers).content
    data = current['data']
    data['people'] = data['people'][5:]
    response = client.post(path + '/revise', headers=headers, json={
        'data': data, 'version': current['version'], 'reason': 'Correction with three retained people'})
    assert response.status_code == 200, response.text
    assert response.json()['data']['people'] == data['people']
    text = pdf_text(client.get(path + '/pdf', headers=headers))
    assert all(f'Fictional person {i}' in text for i in range(5, 8))
    assert all(f'Fictional person {i}' not in text for i in range(5))
    assert client.get(path + '/revisions/1/pdf', headers=headers).content == old


@pytest.mark.parametrize('cpf,valid', [('', True), ('111.111.111-11', False), ('123', False), ('529.982.247-25', True)])
def test_optional_cpf_validation(cpf, valid):
    from pydantic import ValidationError
    from app.schemas.bulletin import Person
    if valid:
        assert Person(cpf=cpf).cpf == cpf
    else:
        with pytest.raises(ValidationError):
            Person(cpf=cpf)
