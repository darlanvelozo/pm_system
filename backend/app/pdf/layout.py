from reportlab.platypus import KeepTogether, Table, TableStyle
from app.pdf.components import WIDTH, header, location, involved, narrative, ending

PDF_LAYOUT_VERSION = '2026.4'


def has_content(value):
    if isinstance(value, dict):
        return any(has_content(v) for v in value.values())
    if isinstance(value, list):
        return any(has_content(v) for v in value)
    return bool(value)


def position_label(index):
    if index < 0:
        raise ValueError('Posição inválida')
    result = ''
    index += 1
    while index:
        index, digit = divmod(index - 1, 26)
        result = chr(65 + digit) + result
    return result


def person_block(rows):
    # Rows stay in one table so the person heading repeats when a block continues on the next page.
    table = Table([[r] for r in rows], colWidths=[WIDTH], repeatRows=1, splitByRow=1)
    table.setStyle(TableStyle([(k, (0, 0), (-1, -1), 0) for k in ('LEFTPADDING', 'RIGHTPADDING', 'TOPPADDING', 'BOTTOMPADDING')]))
    return table


def build(data):
    story = header(data) + location(data)
    for index, person in enumerate(data.people):
        # KeepTogether gives a person a fresh page when possible, but lets large
        # blocks split at row boundaries instead of shrinking or truncating text.
        extra = len(data.people) <= 2 or (person.extras is not None and has_content(person.extras.model_dump()))
        story.append(KeepTogether([person_block(involved(person, position_label(index), extra=extra))]))
    story.extend(narrative('Histórico', data.history, 50))
    story.extend(narrative('Material Apreendido', data.seized_material, 30))
    tail = ending(data)
    story.extend(tail[:-3])
    story.append(KeepTogether(tail[-3:]))
    return story
