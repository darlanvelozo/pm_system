import hashlib
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from io import BytesIO
from pypdf import PdfReader
from sqlalchemy import select, func
from app.db.session import SessionLocal, engine
from app.models.entities import Bulletin, BulletinRevision, BulletinSequence
from app.services.protocol import next_protocol


def test_sequence_format_rollover_and_timezone():
    with SessionLocal() as db:
        instant = datetime(2026, 9, 30, 2, 59, tzinfo=timezone.utc)
        results = [next_protocol(db, instant) for _ in range(100)]
        assert results[0] == '20260929-01'
        assert results[1] == '20260929-02'
        assert results[9] == '20260929-10'
        assert results[99] == '20260929-100'
        assert next_protocol(db, datetime(2026, 9, 30, 3, tzinfo=timezone.utc)) == '20260930-01'


def test_preview_idempotency_and_hash(client, accounts, payload, monkeypatch):
    calls = []
    monkeypatch.setattr('app.services.bulletins.send_bulletin_pdf', lambda *args: calls.append(1) or True)
    headers = accounts['operator']['headers']
    preview = client.post('/api/bo/preview-pdf', headers=headers, json=payload)
    assert preview.status_code == 200
    content = '\n'.join(p.extract_text() for p in PdfReader(BytesIO(preview.content)).pages)
    assert 'PRÉVIA' in content and 'PENDENTE' in content and 'TEST-001' not in content
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(BulletinSequence)) == 0
        assert db.scalar(select(func.count()).select_from(BulletinRevision)) == 0
    assert not calls
    draft = client.post('/api/bo', headers=headers, json={'data': payload}).json()
    assert draft['bo_number'] is None
    path = '/api/bo/' + draft['id']
    key = str(uuid.uuid4())
    response = client.post(path + '/emit', headers={**headers, 'Idempotency-Key': key}, json={'version':draft['version']})
    assert response.status_code == 200, response.text
    issued = response.json()
    again = client.post(path + '/emit', headers={**headers, 'Idempotency-Key': key}, json={'version':draft['version']}).json()
    assert again['id'] == issued['id'] and again['bo_number'] == issued['bo_number'] and again['current_revision'] == 1
    assert len(calls) == 2
    assert client.post(path + '/emit', headers={**headers, 'Idempotency-Key':str(uuid.uuid4())}, json={'version':draft['version']}).status_code == 409
    pdf = client.get(path + '/pdf', headers=headers).content
    verified = client.get(path + '/verify?revision=1',headers=headers).json()
    assert verified['matches'] and verified['pdf_sha256'] == hashlib.sha256(pdf).hexdigest()
    assert 'people' not in verified and 'created_by' not in verified
    assert client.get(path + '/verify?revision=1').status_code == 401
    assert client.get(path + '/verify?revision=1',headers=accounts['other']['headers']).status_code == 404


def test_concurrent_emissions_postgresql(client, accounts, payload, monkeypatch):
    import pytest
    if engine.dialect.name != 'postgresql':
        pytest.skip('Real PostgreSQL concurrency test')
    monkeypatch.setattr('app.services.bulletins.deliver', lambda *args: None)
    headers = accounts['operator']['headers']
    drafts = [client.post('/api/bo',headers=headers,json={'data':payload}).json() for _ in range(8)]
    def issue(draft):
        return client.post('/api/bo/'+draft['id']+'/emit',headers={**headers,'Idempotency-Key':str(uuid.uuid4())},json={'version':draft['version']})
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(issue,drafts))
    assert all(r.status_code == 200 for r in results), [r.text for r in results]
    assert len({r.json()['bo_number'] for r in results}) == 8
    key = str(uuid.uuid4())
    def retry(_):
        return client.post('/api/bo',headers={**headers,'Idempotency-Key':key},json={'data':payload,'emit':True})
    with ThreadPoolExecutor(max_workers=4) as pool:
        repeated = list(pool.map(retry,range(4)))
    assert all(r.status_code == 201 for r in repeated), [r.text for r in repeated]
    assert len({r.json()['id'] for r in repeated}) == 1
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Bulletin)) == 9
        assert db.scalar(select(func.count()).select_from(BulletinRevision)) == 9


def test_failed_pdf_rolls_back_number_and_document(client, accounts, payload, monkeypatch):
    import pytest
    def fail(*args, **kwargs):
        raise RuntimeError('Fictional PDF failure')
    monkeypatch.setattr('app.services.bulletins.generate_pdf', fail)
    with pytest.raises(RuntimeError, match='Fictional PDF failure'):
        client.post('/api/bo',headers={**accounts['operator']['headers'],'Idempotency-Key':str(uuid.uuid4())},json={'data':payload,'emit':True})
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Bulletin)) == 0
        assert db.scalar(select(func.count()).select_from(BulletinSequence)) == 0
        assert db.scalar(select(func.count()).select_from(BulletinRevision)) == 0


def test_qr_contains_only_authenticated_verification_url(payload, monkeypatch):
    from reportlab.graphics.barcode import qr
    from app.pdf.generator import generate_pdf
    from app.schemas.bulletin import BulletinInput
    from app.core.config import settings
    original = qr.QrCodeWidget
    urls = []
    def capture(value):
        urls.append(value)
        return original(value)
    monkeypatch.setattr(qr, 'QrCodeWidget', capture)
    bid = uuid.uuid4()
    content = generate_pdf(BulletinInput.model_validate(payload),bulletin_id=bid,version=2)
    assert content.startswith(b'%PDF')
    assert urls and set(urls) == {f'{settings().frontend_url}/verificar/{bid}?revision=2'}
