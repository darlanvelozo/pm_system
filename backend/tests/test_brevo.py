import base64
import json
from types import SimpleNamespace

import httpx
import pytest

from app.core.config import settings
from app.services import email_service


@pytest.mark.parametrize('failure', [None, 'missing_config', 'auth', 'quota', 'timeout', 'invalid_json', 'missing_id'])
def test_brevo_transport(monkeypatch, payload, failure):
    cfg = settings()
    for key, value in {'email_provider': 'brevo', 'brevo_api_key': 'test-key',
                       'brevo_from': 'sender@example.com', 'brevo_reply_to': 'reply@example.com'}.items():
        monkeypatch.setattr(cfg, key, value)
    if failure == 'missing_config':
        monkeypatch.setattr(cfg, 'brevo_api_key', '')
    calls = []

    def handler(request):
        calls.append(request)
        assert str(request.url) == 'https://api.brevo.com/v3/smtp/email'
        assert request.headers['api-key'] == 'test-key'
        body = json.loads(request.content)
        assert body['to'] == [{'email': 'recipient@example.com'}]
        assert body['sender']['email'] == 'sender@example.com'
        assert body['replyTo']['email'] == 'reply@example.com'
        assert 'cc' not in body and 'bcc' not in body
        assert body['attachment'][0]['name'] == 'BO_TEST_001.pdf'
        assert base64.b64decode(body['attachment'][0]['content']) == b'%PDF-fictional'
        assert 'TEST/001' in body['textContent']
        if failure == 'timeout':
            raise httpx.ReadTimeout('test', request=request)
        if failure == 'invalid_json':
            return httpx.Response(201, text='invalid')
        return httpx.Response({'auth': 401, 'quota': 429}.get(failure, 201),
                              json={} if failure == 'missing_id' else {'messageId': 'test-id'})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(email_service.httpx, 'Client', lambda **kwargs: client)
    bulletin = SimpleNamespace(bo_number='TEST/001', data=payload)
    assert email_service.send_bulletin_pdf('recipient@example.com', bulletin, b'%PDF-fictional') is (failure is None)
    assert len(calls) == (0 if failure == 'missing_config' else 1)
