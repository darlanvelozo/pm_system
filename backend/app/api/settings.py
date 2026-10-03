import time
from collections import defaultdict, deque
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from app import __version__
from app.api.routes import save
from app.auth.security import admin
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import SystemSettings, now
from app.pdf.analytical_report import LAYOUT_VERSION as REPORT_LAYOUT_VERSION
from app.pdf.layout import PDF_LAYOUT_VERSION
from app.schemas.settings import SettingsUpdate, TestEmail
from app.services import system_settings
from app.services.audit import audit
from app.services.email_service import provider_status, send_message

router = APIRouter(prefix='/api/admin', dependencies=[Depends(admin)])
PROVIDERS = {'smtp': 'SMTP', 'brevo': 'Brevo (API HTTPS)', 'gmail_api': 'Gmail API'}
TEST_LIMIT, TEST_WINDOW = 3, 600
test_hits = defaultdict(deque)


@router.get('/settings')
def read_settings(db: Session = Depends(get_db)):
    return system_settings.view(db)


@router.put('/settings')
def update_settings(data: SettingsUpdate, user=Depends(admin), db: Session = Depends(get_db)):
    row = db.get(SystemSettings, 1, with_for_update=True) or SystemSettings(id=1)
    values = data.model_dump(mode='json')
    changed = sorted(field for field, value in values.items() if getattr(row, field, None) != value)
    if changed:
        for field, value in values.items():
            setattr(row, field, value)
        row.updated_at, row.updated_by = now(), user.id
        db.add(row)
        # Field names only; values (names, e-mails) stay out of the audit trail.
        audit(db, user.id, 'SETTINGS_UPDATED', details={'fields': changed})
        save(db)
    return {**system_settings.view(db), 'changed': changed}


def migration_state(db):
    try:
        current = db.execute(text('SELECT version_num FROM alembic_version')).scalar()
    except Exception:
        db.rollback()
        current = None
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        root = Path(__file__).resolve().parents[2]
        config = Config(str(root / 'alembic.ini'))
        config.set_main_option('script_location', str(root / 'alembic'))
        head = ScriptDirectory.from_config(config).get_current_head()
    except Exception:
        head = None
    return {'revision': current, 'head': head, 'up_to_date': bool(current and current == head)}


@router.get('/diagnostics')
def diagnostics(db: Session = Depends(get_db)):
    cfg = settings()
    try:
        db.execute(text('SELECT 1'))
        reachable = True
    except Exception:
        db.rollback()
        reachable = False
    email = provider_status(cfg)
    effective = system_settings.effective_settings(db)
    return {'email': {**email, 'provider_label': PROVIDERS[email['provider']],
                      'battalion_email': effective['battalion_email'],
                      'reply_to': system_settings.stored_reply_to(db) or (cfg.brevo_reply_to if email['provider'] == 'brevo' else None)},
            'app': {'version': __version__, 'bo_pdf_layout': PDF_LAYOUT_VERSION, 'report_pdf_layout': REPORT_LAYOUT_VERSION},
            'database': {'reachable': reachable, 'dialect': db.bind.dialect.name, **migration_state(db)},
            'environment': cfg.environment, 'frontend_url': cfg.frontend_url}


@router.post('/diagnostics/test-email')
def test_email(data: TestEmail, user=Depends(admin), db: Session = Depends(get_db)):
    hits, current = test_hits[user.id], time.monotonic()
    while hits and hits[0] <= current - TEST_WINDOW:
        hits.popleft()
    if len(hits) >= TEST_LIMIT:
        raise HTTPException(429, 'Limite de e-mails de teste atingido. Aguarde alguns minutos.', headers={'Retry-After': str(TEST_WINDOW)})
    hits.append(current)
    status = provider_status()
    unit = system_settings.effective_settings(db)
    sent = status['configured'] and send_message(
        str(data.email), f'Teste de envio — BO Online {unit["unit_short_name"]}',
        f'Mensagem de teste enviada pela tela Configurações do BO Online {unit["unit_short_name"]}.\n'
        'Nenhuma ação é necessária. Não contém dados de boletins.', reply_to=system_settings.stored_reply_to(db))
    result = 'SENT' if sent else 'FAILED'
    audit(db, user.id, f'SETTINGS_TEST_EMAIL_{result}', result=result, details={'provider': status['provider']})
    save(db)
    label = PROVIDERS[status['provider']]
    if sent:
        message = f'{label} aceitou a mensagem. Aceitação não garante entrega: confira a caixa de entrada e o spam.'
    elif not status['configured']:
        message = f'Não enviado: o provedor {label} não está configurado no servidor (remetente ou credenciais ausentes).'
    else:
        message = f'Não enviado: {label} recusou a mensagem ou não respondeu. Verifique credenciais, remetente e cota do provedor.'
    return {'sent': bool(sent), 'provider': status['provider'], 'message': message}
