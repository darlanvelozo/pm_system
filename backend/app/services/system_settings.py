"""Management parameters: database values override environment defaults."""
from app.core.config import settings
from app.models.entities import SystemSettings, User

# Field -> environment fallback (Settings attribute).
FIELDS = {
    'unit_name': 'unit_name', 'unit_short_name': 'unit_short_name', 'unit_city': 'unit_city',
    'battalion_email': 'battalion_email', 'reply_to_email': 'brevo_reply_to',
    'signatory_name': 'report_signatory_name', 'signatory_rank': 'report_signatory_rank',
    'signatory_title': 'report_signatory_title',
}


def stored(db):
    return db.get(SystemSettings, 1) if db is not None else None


def defaults():
    cfg = settings()
    return {field: str(getattr(cfg, env) or '') for field, env in FIELDS.items()}


def effective_settings(db=None):
    row, base = stored(db), defaults()
    return {field: (getattr(row, field, None) or base[field]) for field in FIELDS}


def authority(values):
    return {'name': values['signatory_name'], 'rank': values['signatory_rank'], 'title': values['signatory_title']}


def view(db):
    row = stored(db)
    values = {field: getattr(row, field, None) for field in FIELDS}
    return {'values': values, 'defaults': defaults(), 'effective': effective_settings(db),
            'updated_at': row.updated_at if row else None,
            'updated_by_name': actor.name if (actor := row and row.updated_by and db.get(User, row.updated_by)) else None}


def stored_reply_to(db):
    # Only an admin-defined reply-to applies to every provider; BREVO_REPLY_TO stays Brevo-only.
    row = stored(db)
    return row.reply_to_email if row and row.reply_to_email else None
