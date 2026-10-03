import importlib.util
import uuid
from pathlib import Path
from io import BytesIO
import pytest
from pypdf import PdfReader


def test_generator_role_rejected(client,accounts):
    admin=accounts['admin']['headers']
    response=client.post('/api/admin/users',headers=admin,json={'username':'gerador.teste','name':'Gerador Fictício','password':'Fictional-generator-123','role':'GERADOR'})
    assert response.status_code==422,response.text
    assert client.patch(f'/api/admin/users/{accounts["operator"]["user"].id}',headers=admin,json={'role':'GERADOR'}).status_code==422
    assert client.patch(f'/api/admin/users/{accounts["admin"]["user"].id}',headers=admin,json={'role':'OPERADOR'}).status_code==409


def test_migration_turns_generator_into_common_user(client,accounts,payload):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from app.auth.security import hasher
    from app.db.session import SessionLocal, engine
    from app.models.entities import User
    with SessionLocal() as db:
        db.add(User(username='gerador.legado',name='Gerador Legado Fictício',role='GERADOR',password_hash=hasher.hash('Fictional-generator-123')))
        db.commit()
    login=client.post('/api/auth/login',json={'username':'gerador.legado','password':'Fictional-generator-123'})
    # Before the migration a leftover GERADOR value has no permissions at all.
    assert client.get('/api/bo',headers={'Authorization':'Bearer '+login.json()['access_token']}).status_code==403
    spec=importlib.util.spec_from_file_location('two_roles',Path(__file__).parents[1]/'alembic/versions/20261002_two_roles.py')
    migration=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()
    login=client.post('/api/auth/login',json={'username':'gerador.legado','password':'Fictional-generator-123'})
    assert login.json()['user']['role']=='OPERADOR'
    h={'Authorization':'Bearer '+login.json()['access_token']}
    created=client.post('/api/bo',headers={**h,'Idempotency-Key':str(uuid.uuid4())},json={'data':payload,'emit':True}).json()
    assert 'data' in created and created['status']=='ISSUED'
    assert [b['id'] for b in client.get('/api/bo',headers=h).json()['items']]==[created['id']]
    assert client.get(f'/api/bo/{created["id"]}/pdf',headers=h).status_code==200
    assert client.get('/api/analytical-reports',headers=h).status_code==200
    for path in ('/api/admin/users','/api/admin/audit','/api/admin/stats','/api/admin/settings'):
        assert client.get(path,headers=h).status_code==403,path
    final_text=' '.join(' '.join(p.extract_text() for p in PdfReader(BytesIO(client.get(f'/api/bo/{created["id"]}/pdf',headers=h).content)).pages).split())
    assert 'Posto/Graduação/Nome Cmt' in final_text and 'Posto/Nome Cmt' not in final_text


@pytest.mark.parametrize('count',[1,2,3,4,5,8,12])
def test_new_commander_label(client,accounts,payload,count):
    profiles=['DYNAMIC']+(['TWO_INVOLVED'] if count==2 else ['FOUR_INVOLVED'] if count==4 else [])
    for profile in profiles:
        data={**payload,'bulletin_type':profile,'people':[{'name':f'Pessoa Fictícia {n}','role':'Comunicante'} for n in range(count)]}
        response=client.post('/api/bo/preview-pdf',headers=accounts['operator']['headers'],json=data)
        assert response.status_code==200,response.text
        text='\n'.join(p.extract_text() for p in PdfReader(BytesIO(response.content)).pages)
        # Line wrapping may insert whitespace but the visible label is unchanged.
        text=' '.join(text.split())
        assert 'Posto/Graduação/Nome Cmt' in text
        assert 'Posto/Nome Cmt' not in text


def test_split_paragraphs_keep_spaces(client,accounts,payload):
    # Text continued on another page must not lose spaces between words.
    data={**payload,'seized_material':'Material fictício item. '*400+'FIM MATERIAL','people':[{**payload['people'][0],'observations':'Obs fictícia '*35,'distinguishing_features':'Marca fictícia '*30}]*6}
    pdf=client.post('/api/bo/preview-pdf',headers=accounts['admin']['headers'],json=data)
    assert pdf.status_code==200,pdf.text
    text=' '.join(' '.join(p.extract_text() for p in PdfReader(BytesIO(pdf.content)).pages).split())
    assert 'FIM MATERIAL' in text
    assert 'Materialfictício' not in text and 'item.Material' not in text
