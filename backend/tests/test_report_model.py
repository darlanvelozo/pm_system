"""Analytical report PDF following the battalion's current model (layout 2026.2)."""
import base64
import hashlib
import math
import struct
import uuid
import zlib
from io import BytesIO
from pypdf import PdfReader
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.analytical_report import AnalyticalReportRevision
from app.models.entities import AuditLog
from tests.test_settings import REPORT, text_of

ADDRESS = 'Av. Fictícia, s/n, bairro Teste, Cep 00000000 – Cidade Fictícia-MA, Fones: 99 900000000'
CONTACT = 'e-mail: batalhao.ficticio@example.com'
SIGNER = {'signatory_rank': 'MAJ QOEM', 'signatory_name': 'Fulano Fictício da Silva', 'signatory_title': 'Comandante do 24º BPM'}
URL = '/api/admin/settings/signature'


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))


def fake_signature(width=240, height=60):
    """Fictitious scribble ("Assinatura Fictícia") as a minimal grayscale PNG."""
    ink = {(x, int(height / 2 + 18 * math.sin(x / 11) + dy)) for x in range(10, width - 10) for dy in (0, 1, 2)}
    raw = b''.join(b'\x00' + bytes(30 if (x, y) in ink else 255 for x in range(width)) for y in range(height))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 0, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))


def upload(client, headers, content):
    return client.put(URL, headers=headers, json={'data_base64': base64.b64encode(content).decode()})


def preview(client, accounts):
    response = client.post('/api/analytical-reports/preview-pdf', headers=accounts['operator']['headers'], json=REPORT)
    assert response.status_code == 200, response.text
    return response.content


def images(content):
    return sum(len(page.images) for page in PdfReader(BytesIO(content)).pages)


def test_model_header_closing_and_footer(client, accounts):
    admin = accounts['admin']['headers']
    assert client.put('/api/admin/settings', headers=admin, json={**SIGNER, 'footer_address': ADDRESS, 'footer_contact': CONTACT}).status_code == 200
    text = text_of(preview(client, accounts))
    for expected in ('ESTADO DO MARANHÃO', 'COMANDO DO POLICIAMENTO DO INTERIOR', '24º BATALHÃO DE POLÍCIA MILITAR',
                     'RELATÓRIO ANALÍTICO DE OCORRÊNCIA PENDENTE', 'RELATO DA OCORRÊNCIA', 'PROVIDÊNCIAS ADOTADAS',
                     'LOCAL: Cidade Fictícia', 'DATA: 30/09/2026 12:30:00', 'MAJ QOEM Fulano Fictício da Silva Comandante do 24º BPM',
                     ADDRESS, CONTACT, 'PRÉVIA — NÃO EMITIDO', 'Registrado por: operator', 'Página 1'):
        assert expected in text, expected
    assert '24º Batalhão de Polícia Militar · Coroatá/MA' not in text


def test_long_report_keeps_footer_on_every_page(client, accounts):
    admin = accounts['admin']['headers']
    client.put('/api/admin/settings', headers=admin, json={'footer_address': ADDRESS, 'footer_contact': CONTACT})
    response = client.post('/api/analytical-reports/preview-pdf', headers=accounts['operator']['headers'],
                           json={**REPORT, 'narrative': ' '.join(['Relato fictício longo para teste de paginação.'] * 400)})
    pages = PdfReader(BytesIO(response.content)).pages
    assert len(pages) >= 2
    assert all(ADDRESS in ' '.join(p.extract_text().split()) and CONTACT in p.extract_text() for p in pages)
    assert 'paginação.Relato' not in text_of(response.content)


def test_defaults_keep_previous_footer_and_no_signature(client, accounts):
    content = preview(client, accounts)
    assert '24º Batalhão de Polícia Militar · Coroatá/MA' in text_of(content)
    assert images(content) == 3  # PM 190 anos, Maranhão coat of arms and 24º BPM crest only.
    settings = client.get('/api/admin/settings', headers=accounts['admin']['headers']).json()
    assert settings['has_signature'] is False and settings['signature_mime'] is None
    assert client.get(URL, headers=accounts['admin']['headers']).status_code == 404


def test_signature_upload_embeds_in_pdf_and_removal(client, accounts):
    admin, signature = accounts['admin']['headers'], fake_signature()
    response = upload(client, admin, signature)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['has_signature'] is True and body['signature_mime'] == 'image/png'
    assert base64.b64encode(signature).decode() not in response.text
    image = client.get(URL, headers=admin)
    assert image.content == signature and image.headers['content-type'] == 'image/png' and 'no-store' in image.headers['cache-control']
    assert images(preview(client, accounts)) == 4
    with SessionLocal() as db:
        assert [log.details for log in db.scalars(select(AuditLog).where(AuditLog.action == 'SETTINGS_UPDATED'))] == [{'fields': ['signature_image']}]
    # Revisions keep only a fingerprint of the signature, never its bytes.
    h = accounts['operator']['headers']
    r = client.post('/api/analytical-reports', headers=h, json={'data': REPORT}).json()
    assert client.post(f'/api/analytical-reports/{r["id"]}/emit', headers={**h, 'Idempotency-Key': str(uuid.uuid4())}, json={'version': r['version']}).status_code == 200
    with SessionLocal() as db:
        assert db.scalar(select(AnalyticalReportRevision)).data['signatory']['signature_sha256'] == hashlib.sha256(signature).hexdigest()
    removed = client.delete(URL, headers=admin)
    assert removed.status_code == 200 and removed.json()['has_signature'] is False
    assert images(preview(client, accounts)) == 3
    assert client.get(URL, headers=admin).status_code == 404


def test_signature_validation(client, accounts):
    admin = accounts['admin']['headers']
    assert upload(client, admin, b'texto qualquer, nao e imagem').status_code == 422
    assert upload(client, admin, b'\x89PNG\r\n\x1a\nfalso conteudo').status_code == 422
    assert upload(client, admin, b'\xff\xd8\xff' + b'0' * 100).status_code == 422
    assert client.put(URL, headers=admin, json={'data_base64': '%%%não-base64%%%'}).status_code == 422
    assert upload(client, admin, fake_signature()[:8] + b'0' * (500 * 1024)).status_code == 413
    assert upload(client, accounts['operator']['headers'], fake_signature()).status_code == 403
    assert client.delete(URL, headers=accounts['operator']['headers']).status_code == 403
    assert client.get(URL, headers=accounts['operator']['headers']).status_code == 403
    assert client.get('/api/admin/settings', headers=admin).json()['has_signature'] is False


def test_footer_fields_validation(client, accounts):
    admin = accounts['admin']['headers']
    assert client.put('/api/admin/settings', headers=admin, json={'footer_address': 'x' * 201}).status_code == 422
    assert client.put('/api/admin/settings', headers=admin, json={'footer_contact': 'linha\nquebrada'}).status_code == 422
