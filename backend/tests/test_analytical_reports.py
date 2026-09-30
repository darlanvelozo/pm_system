import hashlib
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from io import BytesIO
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlalchemy import select, func
from app.main import app
from app.db.session import SessionLocal, engine
from app.models.entities import AuditLog, PdfFile, User
from app.models.analytical_report import AnalyticalReport, AnalyticalReportRevision, AnalyticalReportSequence
from app.services.analytical_reports import next_report_number, email_summary


@pytest.fixture
def report_payload():
    return {'recipient_email':'fictional@example.com','occurrence_type':'ROUBO FICTÍCIO','location':'Rua de teste, local fictício',
        'occurrence_date':'2026-09-30','occurrence_time':'12:30','victims':'Vítima Fictícia 12345678900',
        'involved':'Envolvido Fictício','witnesses':'Testemunha Fictícia','fled':'NÃO','samu':'SIM','icrim':'NÃO',
        'narrative':'Narrativa fictícia privada.','measures':'Providências fictícias privadas.',
        'closing_location':'Cidade Fictícia','closing_date':'2026-09-30'}


@pytest.fixture(autouse=True)
def no_real_mail(monkeypatch):
    monkeypatch.setattr('app.services.analytical_reports.send_document_pdf', lambda *args: True)


def draft(client, headers, payload):
    response = client.post('/api/analytical-reports', headers=headers, json={'data':payload})
    assert response.status_code == 201, response.text
    return response.json()


def issue(client, headers, report, key=None):
    return client.post(f'/api/analytical-reports/{report["id"]}/emit', headers={**headers,'Idempotency-Key':str(key or uuid.uuid4())},json={'version':report['version']})


def test_report_lifecycle_preview_hash_identity_email(client, accounts, report_payload, monkeypatch):
    calls = []
    monkeypatch.setattr('app.services.analytical_reports.send_document_pdf', lambda *args: calls.append(args) or True)
    h = accounts['operator']['headers']
    admin = accounts['admin']['headers']
    preview = client.post('/api/analytical-reports/preview-pdf',headers=h,json=report_payload)
    assert preview.status_code == 200
    text = '\n'.join(p.extract_text() for p in PdfReader(BytesIO(preview.content)).pages)
    assert 'PRÉVIA' in text and 'PENDENTE' in text
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(AnalyticalReportSequence)) == 0
        assert db.scalar(select(func.count()).select_from(AnalyticalReportRevision)) == 0
    assert not calls
    r = draft(client,h,report_payload)
    assert r['report_number'] is None
    key = uuid.uuid4()
    emitted = issue(client,h,r,key)
    assert emitted.status_code == 200, emitted.text
    r2 = emitted.json()
    path = f'/api/analytical-reports/{r["id"]}'
    assert issue(client,h,r,key).json()['report_number'] == r2['report_number']
    assert len(calls) == 2 and calls[0][1] == calls[1][1]
    assert client.get(path,headers=accounts['other']['headers']).status_code == 404
    assert client.get('/api/analytical-reports',headers=accounts['other']['headers']).json()['total'] == 0
    pdf = client.get(path+'/pdf',headers=h).content
    with SessionLocal() as db:
        rev = db.scalar(select(AnalyticalReportRevision))
        assert rev.pdf_sha256 == hashlib.sha256(pdf).hexdigest()
        assert db.get(PdfFile,rev.pdf_storage_key).content == pdf
        report = db.get(AnalyticalReport,uuid.UUID(r['id']))
        subject,body,attachment = email_summary(report)
        assert 'Relatório Analítico' in subject and 'Cidade Fictícia' in subject
        assert 'RELATORIO_ANALITICO_' in attachment
        for private in ('Vítima Fictícia','12345678900','Narrativa fictícia privada','Rua de teste','Providências fictícias privadas'):
            assert private not in subject+body+attachment
    with SessionLocal() as db:
        creator = db.get(User, accounts['operator']['user'].id)
        creator.name, creator.username = 'Nome alterado depois', 'login.alterado'
        db.commit()
    latest = client.get(path,headers=admin).json()
    assert latest['created_by_name'] == 'operator'
    changed = {**report_payload,'narrative':'Correção fictícia preservada'}
    assert client.post(path+'/revise',headers=h,json={'data':changed,'version':latest['version'],'reason':'Teste fictício'}).status_code == 403
    revised = client.post(path+'/revise',headers=admin,json={'data':changed,'version':latest['version'],'reason':'Correção fictícia'})
    assert revised.status_code == 200, revised.text
    assert revised.json()['current_revision'] == 2 and revised.json()['report_number'] == r2['report_number']
    assert revised.json()['created_by_name'] == 'operator'
    assert revised.json()['recipient_email_status'] == 'NOT_SENT' and len(calls) == 2
    versions = client.get(path+'/revisions',headers=admin).json()
    assert len(versions) == 2 and versions[0]['pdf_sha256'] != versions[1]['pdf_sha256']
    assert client.get(path+'/revisions/1/pdf',headers=admin).content == pdf
    assert client.post(path+'/resend-email',headers=admin,json={'target':'recipient'}).status_code == 202
    assert len(calls) == 3
    assert client.post(path+'/cancel',headers=admin,json={'reason':'Cancelamento fictício'}).json()['status'] == 'CANCELLED'
    assert client.post(path+'/remove',headers=admin,json={'reason':'Remoção fictícia'}).json()['status'] == 'REMOVED'
    assert client.get(path,headers=h).status_code == 404
    assert client.get(path+'/revisions/1/pdf',headers=admin).content == pdf
    with SessionLocal() as db:
        logs = db.scalars(select(AuditLog).where(AuditLog.report_id == uuid.UUID(r['id']))).all()
        assert any(a.action == 'ANALYTICAL_REPORT_REVISED' for a in logs)
        assert all(a.actor_name_snapshot in ('admin','operator') for a in logs)


def test_report_long_pdf_fields_and_authority(client, accounts, report_payload, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings(),'report_signatory_name','Autoridade Fictícia')
    monkeypatch.setattr(settings(),'report_signatory_rank','POSTO TESTE')
    monkeypatch.setattr(settings(),'report_signatory_title','Função de teste')
    data = {**report_payload,'narrative':('Narrativa longa fictícia. '*1200)+'FINAL_RELATO', 'measures':('Providências fictícias. '*1000)+'FINAL_PROVIDENCIAS'}
    response = client.post('/api/analytical-reports/preview-pdf',headers=accounts['operator']['headers'],json=data)
    assert response.status_code == 200, response.text
    reader = PdfReader(BytesIO(response.content))
    text = '\n'.join(p.extract_text() for p in reader.pages)
    assert len(reader.pages) > 2
    for label in ('RELATÓRIO ANALÍTICO DE OCORRÊNCIA','Código/Tipo de Ocorrência','Local','Data / hora','Vítima','Envolvido','Testemunha','Materiais apreendidos','Tipo de arma usada','Outros','Solução da ocorrência','Causa/Motivo','Viatura','RELATO DA OCORRÊNCIA','PROVIDÊNCIAS ADOTADAS','FINAL_RELATO','FINAL_PROVIDENCIAS','Autoridade Fictícia'):
        assert label in text
    assert 'Adenywton' not in text


def test_report_conflict_filters_and_rollback(client,accounts,report_payload,monkeypatch):
    h=accounts['operator']['headers']
    r=draft(client,h,report_payload)
    path=f'/api/analytical-reports/{r["id"]}'
    update=client.put(path,headers=h,json={'data':{**report_payload,'cause':'Teste'},'version':r['version']})
    assert update.status_code == 200
    assert client.put(path,headers=h,json={'data':report_payload,'version':r['version']}).status_code == 409
    assert client.get('/api/analytical-reports?q=ROUBO&city=Cidade&date_from=2026-09-01',headers=h).json()['total'] == 1
    assert client.get('/api/analytical-reports?date_to=2026-01-01',headers=h).json()['total'] == 0
    def fail(*args,**kwargs):
        raise RuntimeError('Fictitious PDF failure')
    monkeypatch.setattr('app.services.analytical_reports.generate_report_pdf',fail)
    with pytest.raises(RuntimeError):
        issue(client,h,update.json())
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(AnalyticalReportSequence)) == 0
        assert db.get(AnalyticalReport,uuid.UUID(r['id'])).report_number is None


def test_report_annual_sequence():
    with SessionLocal() as db:
        instant=datetime(2027,1,1,2,59,tzinfo=timezone.utc)
        assert next_report_number(db,instant)=='1/2026'
        assert next_report_number(db,instant)=='2/2026'
        assert next_report_number(db,datetime(2027,1,1,3,tzinfo=timezone.utc))=='1/2027'


def test_report_postgres_concurrency(client,accounts,report_payload):
    if engine.dialect.name != 'postgresql':
        pytest.skip('Requires disposable PostgreSQL')
    h=accounts['operator']['headers']
    reports=[draft(client,h,report_payload) for _ in range(6)]
    def send(r,key=None):
        with TestClient(app) as c:
            response=issue(c,h,r,key)
            assert response.status_code == 200,response.text
            return response.json()
    with ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(send,reports))
    assert len({r['report_number'] for r in results}) == 6
    r=draft(client,h,report_payload)
    key=uuid.uuid4()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda _:send(r,key),range(4)))
    assert len({r['report_number'] for r in results}) == 1
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(AnalyticalReportRevision)) == 7
