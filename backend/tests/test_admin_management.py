def test_edit_identity_password_and_snapshot(client, accounts):
    h = accounts['admin']['headers']
    data = {'name': 'João Teste Operador', 'username': 'joao.teste', 'password': 'Fictional-password-123'}
    r = client.post('/api/admin/users', headers=h, json=data)
    assert r.status_code == 201
    uid = r.json()['id']
    assert client.post('/api/auth/login', json={'username': 'JOAO.TESTE', 'password': data['password']}).status_code == 200
    r = client.patch('/api/admin/users/' + uid, headers=h, json={'name': 'Nome Atualizado', 'username': 'novo.login', 'password': ''})
    assert r.status_code == 200
    assert client.post('/api/auth/login', json={'username': 'novo.login', 'password': data['password']}).status_code == 200
    events = client.get('/api/admin/audit', headers=h).json()
    assert any(e['user_name'] == 'João Teste Operador' and e['username'] == 'joao.teste' for e in events)
    assert client.patch('/api/admin/users/' + uid, headers=h, json={'password': 'Changed-fictional-456'}).status_code == 200
    assert client.post('/api/auth/login', json={'username': 'novo.login', 'password': data['password']}).status_code == 401
    assert client.post('/api/auth/login', json={'username': 'novo.login', 'password': 'Changed-fictional-456'}).status_code == 200
    assert client.patch('/api/admin/users/' + uid, headers=h, json={'active': False}).status_code == 200
    assert client.post('/api/auth/login', json={'username': 'novo.login', 'password': 'Changed-fictional-456'}).status_code == 401
    assert client.patch('/api/admin/users/' + uid, headers=h, json={'active': True}).status_code == 200
    assert client.post('/api/auth/login', json={'username': 'novo.login', 'password': 'Changed-fictional-456'}).status_code == 200
    assert client.patch('/api/admin/users/' + str(accounts['admin']['user'].id), headers=h, json={'active': False}).status_code == 409
