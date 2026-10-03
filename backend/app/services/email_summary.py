"""Deterministic metadata only; never copy narrative or personal fields."""
import re
import unicodedata


def safe_metadata(value, bulletin, limit=80):
    value = ' '.join(str(value or '').split())
    for person in getattr(bulletin, 'people', []):
        for field in ('name', 'mother_name', 'cpf', 'rg', 'phone', 'address'):
            private = str(person.data.get(field, '')).strip()
            if private:
                value = re.sub(re.escape(private), '[omitido]', value, flags=re.IGNORECASE)
    value = re.sub(r'\d[\d.()/ -]{6,}\d', '[omitido]', value)
    return value[:limit]


def email_summary(b, unit_short='24º BPM'):
    d = b.data
    kind = safe_metadata(d.get('occurrence_type'), b) or 'OCORRÊNCIA'
    summary = safe_metadata(d.get('occurrence_summary'), b)
    city = safe_metadata(d.get('location', {}).get('city'), b)
    neighborhood = safe_metadata(d.get('location', {}).get('neighborhood'), b)
    label = summary if kind.casefold() in ('outro', 'outros') and summary else kind
    suffix = f' | Revisão {b.current_revision}' if b.current_revision > 1 else ''
    subject = f'BO {b.bo_number} | {label} | {city}'[:170] + suffix
    date = d.get('occurrence_date') or ''
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
        date = '/'.join(reversed(date.split('-')))
    body = (f'Prezados,\n\nSegue em anexo o Boletim de Ocorrência nº {b.bo_number}.\n'
            f'Tipo de ocorrência: {kind}\nDescrição breve: {summary or "Não informada"}\n'
            f'Data/Hora: {date} às {d.get("occurrence_time", "")}\n'
            f'Local: {neighborhood} — {city}\nEnvolvidos cadastrados: {len(b.people)}\n'
            f'Material apreendido informado: {"Sim" if d.get("seized_material") else "Não"}\n'
            f'Registrado por: {b.registered_by_name_snapshot} ({b.registered_by_username_snapshot})\n'
            f'Versão do documento: {b.current_revision}\n\nO documento completo segue em anexo.\n'
            f'Esta mensagem foi gerada automaticamente pelo BO Online {unit_short}.\n\nAtenciosamente,\n{unit_short}')
    safe_kind = unicodedata.normalize('NFKD', kind).encode('ascii', 'ignore').decode()
    safe_kind = re.sub(r'[^A-Za-z0-9_-]', '_', safe_kind)[:60]
    number = re.sub(r'[^A-Za-z0-9_-]', '_', b.bo_number)[:100]
    return subject, body, f'BO_{number}_{safe_kind}_v{b.current_revision}.pdf'
