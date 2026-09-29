def test_username_without_email(client, accounts):
    payload = {'username': 'Novo.Usuario', 'name': 'Teste', 'password': 'Fictional-password-123', 'role': 'OPERADOR'}
    created = client.post('/api/admin/users', json=payload, headers=accounts['admin']['headers'])
    assert created.status_code == 201
    assert created.json()['username'] == 'novo.usuario'
    assert created.json()['email'] is None
    login = client.post('/api/auth/login', json={'username': 'NOVO.USUARIO', 'password': payload['password']})
    assert login.status_code == 200
    assert client.post('/api/auth/login', json={'username': 'novo.usuario', 'password': 'wrong'}).status_code == 401
    assert client.post('/api/admin/users', json=payload, headers=accounts['admin']['headers']).status_code == 409
    events = client.get('/api/admin/audit', headers=accounts['admin']['headers']).json()
    event = next(e for e in events if e['action'] == 'USER_LOGIN' and e['username'] == 'novo.usuario')
    assert event['user_name'] == 'Teste'
