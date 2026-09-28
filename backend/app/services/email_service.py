import re
import smtplib
import ssl
from email.message import EmailMessage
from app.core.config import settings


def filename(number):
    safe = re.sub(r'[^A-Za-z0-9_-]', '_', number)[:100]
    return f'BO_{safe}.pdf'


def send_bulletin_pdf(recipient, bulletin, pdf_bytes):
    cfg = settings()
    if not cfg.smtp_host or not cfg.smtp_from:
        return False
    message = EmailMessage()
    message['Subject'] = f'Boletim de Ocorrência - {bulletin.bo_number}'
    message['From'] = cfg.smtp_from
    message['To'] = recipient
    message.set_content(f'Prezados,\n\nSegue, em anexo, o Boletim de Ocorrência nº {bulletin.bo_number}, referente à ocorrência registrada em {bulletin.data["occurrence_date"]}.\n\nEste e-mail foi gerado automaticamente pelo Sistema BO Online 24º BPM.\n\nAtenciosamente,\n24º BPM')
    message.add_attachment(pdf_bytes, maintype='application', subtype='pdf', filename=filename(bulletin.bo_number))
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
