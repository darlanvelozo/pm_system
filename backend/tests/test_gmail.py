import base64
import json
from email import policy
from email.parser import BytesParser
from types import SimpleNamespace

import httpx
import pytest

from app.core.config import settings
from app.services import email_service


@pytest.mark.parametrize('failure', [None, 'token', 'send', 'timeout', 'missing_id', 'missing_config'])
def test_gmail_transport(monkeypatch, payload, failure):
    cfg = settings()
    for key, value in {'email_provider': 'gmail_api', 'gmail_client_id': 'test-client',
                       'gmail_client_secret': 'test-secret', 'gmail_refresh_token': 'test-refresh',
                       'gmail_from': 'sender@example.com'}.items():
        monkeypatch.setattr(cfg, key, value)
    if failure == 'missing_config':
        monkeypatch.setattr(cfg, 'gmail_refresh_token', '')
    calls = []

    def handler(request):
        calls.append(request)
        if failure == 'timeout':
            raise httpx.ReadTimeout('test', request=request)
        if request.url.host == 'oauth2.googleapis.com':
            assert b'grant_type=refresh_token' in request.content
            return httpx.Response(400 if failure == 'token' else 200, json={'access_token': 'test-token'})
        assert request.url == 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
        assert request.headers['Authorization'] == 'Bearer test-token'
        message = BytesParser(policy=policy.default).parsebytes(
            base64.urlsafe_b64decode(json.loads(request.content)['raw']))
        assert message['From'] == 'sender@example.com'
        assert message['To'] == 'recipient@example.com'
        assert message['Cc'] is None
        attachment = next(message.iter_attachments())
        assert attachment.get_payload(decode=True) == b'%PDF-fictional'
        assert attachment.get_filename() == 'BO_TEST_001.pdf'
        return httpx.Response(403 if failure == 'send' else 200,
                              json={} if failure == 'missing_id' else {'id': 'test-message'})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(email_service.httpx, 'Client', lambda **kwargs: client)
    bulletin = SimpleNamespace(bo_number='TEST/001', data=payload)
    assert email_service.send_bulletin_pdf('recipient@example.com', bulletin, b'%PDF-fictional') is (failure is None)
    if failure == 'missing_config':
        assert not calls
