import re
import base64
import httpx
import smtplib
import ssl
from email.message import EmailMessage
from app.core.config import settings
from app.services.email_summary import email_summary


def filename(number):
    safe = re.sub(r'[^A-Za-z0-9_-]', '_', number)[:100]
    return f'BO_{safe}.pdf'


def send_bulletin_pdf(recipient, bulletin, pdf_bytes, options=None):
    options = options or {}
    return send_document_pdf(recipient, pdf_bytes, *email_summary(bulletin, options.get('unit_short') or '24º BPM'), options.get('reply_to'))


def provider_status(cfg=None):
    """Booleans only: never expose keys, passwords or tokens."""
    cfg = cfg or settings()
    sender = {'gmail_api': cfg.gmail_from, 'brevo': cfg.brevo_from, 'smtp': cfg.smtp_from}[cfg.email_provider]
    credentials = {'smtp': bool(cfg.smtp_host), 'brevo': bool(cfg.brevo_api_key),
                   'gmail_api': all((cfg.gmail_client_id, cfg.gmail_client_secret, cfg.gmail_refresh_token))}[cfg.email_provider]
    return {'provider': cfg.email_provider, 'sender_configured': bool(sender), 'credentials_configured': credentials,
            'configured': bool(sender) and credentials}


def send_document_pdf(recipient, pdf_bytes, subject, body, attachment, reply_to=None):
    return send_message(recipient, subject, body, pdf_bytes, attachment, reply_to)


def send_message(recipient, subject, body, pdf_bytes=None, attachment=None, reply_to=None):
    cfg = settings()
    if cfg.email_provider == 'smtp' and (not cfg.smtp_host or not cfg.smtp_from):
        return False
    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = {'gmail_api': cfg.gmail_from, 'brevo': cfg.brevo_from, 'smtp': cfg.smtp_from}[cfg.email_provider]
    message['To'] = recipient
    if reply_to:
        message['Reply-To'] = reply_to
    message.set_content(body)
    if pdf_bytes is not None:
        message.add_attachment(pdf_bytes, maintype='application', subtype='pdf', filename=attachment)
    if cfg.email_provider == 'gmail_api':
        return send_gmail_message(cfg, message)
    if cfg.email_provider == 'brevo':
        return send_brevo_message(cfg, message)
    try:
        context = ssl.create_default_context()
        if cfg.smtp_ssl:
            connection = smtplib.SMTP_SSL(cfg.smtp_host, cfg.smtp_port, timeout=20, context=context)
        else:
            connection = smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=20)
        with connection as server:
            if not cfg.smtp_ssl:
                server.starttls(context=context)
            if cfg.smtp_username:
                server.login(cfg.smtp_username, cfg.smtp_password)
            server.send_message(message)
        return True
    except (OSError, smtplib.SMTPException, ValueError):
        return False


def send_brevo_message(cfg, message):
    if not cfg.brevo_api_key or not cfg.brevo_from:
        return False
    payload = {
        'sender': {'email': cfg.brevo_from, 'name': cfg.brevo_from_name},
        'to': [{'email': str(message['To'])}],
        'subject': str(message['Subject']),
        'textContent': message.get_body(preferencelist=('plain',)).get_content(),
    }
    attachments = [{'name': part.get_filename(), 'content': base64.b64encode(part.get_payload(decode=True)).decode('ascii')}
                   for part in message.iter_attachments()]
    if attachments:
        payload['attachment'] = attachments
    reply_to = message['Reply-To'] or cfg.brevo_reply_to
    if reply_to:
        payload['replyTo'] = {'email': str(reply_to)}
    try:
        with httpx.Client(timeout=20) as client:
            response = client.post('https://api.brevo.com/v3/smtp/email',
                                   headers={'api-key': cfg.brevo_api_key}, json=payload)
            response.raise_for_status()
            result = response.json()
            return isinstance(result, dict) and isinstance(result.get('messageId'), str) and bool(result['messageId'])
    except (httpx.HTTPError, ValueError):
        return False


def send_gmail_message(cfg, message):
    if not all((cfg.gmail_client_id, cfg.gmail_client_secret, cfg.gmail_refresh_token, cfg.gmail_from)):
        return False
    try:
        with httpx.Client(timeout=20) as client:
            token_response = client.post('https://oauth2.googleapis.com/token', data={
                'client_id': cfg.gmail_client_id,
                'client_secret': cfg.gmail_client_secret,
                'refresh_token': cfg.gmail_refresh_token,
                'grant_type': 'refresh_token',
            })
            token_response.raise_for_status()
            token = token_response.json().get('access_token')
            if not isinstance(token, str) or not token:
                return False
            response = client.post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
                headers={'Authorization': f'Bearer {token}'},
                json={'raw': base64.urlsafe_b64encode(message.as_bytes()).decode('ascii')})
            response.raise_for_status()
            return bool(response.json().get('id'))
    except (httpx.HTTPError, ValueError, AttributeError):
        return False
