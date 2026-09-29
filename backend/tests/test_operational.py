import uuid
from types import SimpleNamespace
from app.services.email_summary import email_summary


def test_summary_privacy_and_revision(payload):
    payload.update(occurrence_type='ROUBO', occurrence_summary='Descrição breve fictícia', history='NARRATIVA QUE NAO DEVE SAIR', seized_material='Item fictício')
    payload['location'].update(city='Cidade Fictícia', neighborhood='Centro', street='Endereco que nao deve sair')
    b = SimpleNamespace(bo_number='20260929-03',current_revision=2,data=payload,
                        registered_by_name_snapshot='Operador Fictício',registered_by_username_snapshot='operador.teste',
                        people=[SimpleNamespace(data={'name':'Pessoa Privada','cpf':'529.982.247-25','rg':'98765432','phone':'99999999999'})])
    subject,body,attachment = email_summary(b)
    assert subject == 'BO 20260929-03 | ROUBO | Cidade Fictícia | Revisão 2'
    assert all(s in body for s in ['01/01/2026','12:30','Centro','Envolvidos cadastrados: 1','Operador Fictício (operador.teste)','Versão do documento: 2'])
    assert 'NARRATIVA' not in body and 'Endereco' not in body
    assert attachment == 'BO_20260929-03_ROUBO_v2.pdf'
    payload['occurrence_type'] = 'Pessoa Privada 529.982.247-25 98765432 99999999999\nHeader'
    subject,_,attachment = email_summary(b)
    assert not any(v in subject or v in attachment for v in ['Pessoa Privada','529.982.247-25','98765432','99999999999','\n'])


def test_filters_stats_and_reuse_are_authorized(client, accounts, payload):
    op,other,admin = (accounts[k]['headers'] for k in ('operator','other','admin'))
    payload.update(occurrence_summary='Resumo pesquisavel',occurrence_type='Tipo ficticio')
    draft = client.post('/api/bo',headers=op,json={'data':payload}).json()
    issued = client.post('/api/bo/'+draft['id']+'/emit',headers={**op,'Idempotency-Key':str(uuid.uuid4())},json={'version':draft['version']}).json()
    query = '/api/bo?q=pesquisavel&date_from=2026-01-01&date_to=2026-01-01&city=Fict&revision=1'
    assert client.get(query,headers=op).json()['total'] == 1
    assert client.get(query,headers=other).json()['total'] == 0
    assert client.get('/api/bo?q='+issued['bo_number'][4:],headers=op).json()['total'] == 1
    assert client.get('/api/bo?date_from=2026-02-01&date_to=2026-01-01',headers=op).status_code == 422
    assert client.get('/api/admin/stats',headers=op).status_code == 403
    stats = client.get('/api/admin/stats?occurrence_type=ficticio',headers=admin).json()
    assert stats['total'] == 1 and stats['statuses']['ISSUED'] == 1
    assert 'people' not in stats and 'history' not in stats
    options = client.get('/api/operational-options',headers=op).json()
    assert options['occurrence_types'] == ['Tipo ficticio']
    assert set(options) == {'occurrence_types','team','delivery'}
    assert not client.get('/api/operational-options',headers=other).json()['team']
