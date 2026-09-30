import uuid
from io import BytesIO
import pytest
from pypdf import PdfReader


def test_generator_permissions_and_last_admin(client,accounts,payload):
    admin=accounts['admin']['headers']
    response=client.post('/api/admin/users',headers=admin,json={'username':'gerador.teste','name':'Gerador Fictício','password':'Fictional-generator-123','role':'GERADOR'})
    assert response.status_code == 201,response.text
    login=client.post('/api/auth/login',json={'username':'gerador.teste','password':'Fictional-generator-123'})
    assert login.status_code==200 and login.json()['user']['role']=='GERADOR'
    h={'Authorization':'Bearer '+login.json()['access_token']}
    for path in ('/api/bo','/api/admin/users','/api/admin/audit','/api/admin/stats','/api/analytical-reports','/api/operational-options'):
        assert client.get(path,headers=h).status_code==403,path
    assert client.post('/api/analytical-reports',headers=h,json={'data':{}}).status_code==403
    r=client.post('/api/bo',headers=h,json={'data':payload}).json()
    path=f'/api/bo/{r["id"]}'
    assert client.get('/api/bo/active-draft',headers=h).json()['id']==r['id']
    updated=client.put(path,headers=h,json={'data':payload,'version':r['version']}).json()
    assert client.get(path,headers=h).status_code==200
    assert client.post('/api/bo/preview-pdf',headers=h,json=payload).status_code==200
    key=str(uuid.uuid4())
    issued=client.post(path+'/emit',headers={**h,'Idempotency-Key':key},json={'version':updated['version']})
    assert issued.status_code==200,issued.text
    assert 'data' not in issued.json()
    final_pdf=client.get(path+'/pdf',headers=admin)
    final_text=' '.join(' '.join(p.extract_text() for p in PdfReader(BytesIO(final_pdf.content)).pages).split())
    assert 'Posto/Graduação/Nome Cmt' in final_text and 'Posto/Nome Cmt' not in final_text
    assert client.post(path+'/emit',headers={**h,'Idempotency-Key':key},json={'version':updated['version']}).json()['bo_number']==issued.json()['bo_number']
    for suffix in ('','/pdf','/verify?revision=1','/revisions','/revisions/1/pdf'):
        assert client.get(path+suffix,headers=h).status_code==403
    assert client.get('/api/bo/active-draft',headers=h).json() is None
    assert client.patch(f'/api/admin/users/{accounts["admin"]["user"].id}',headers=admin,json={'role':'GERADOR'}).status_code==409


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
