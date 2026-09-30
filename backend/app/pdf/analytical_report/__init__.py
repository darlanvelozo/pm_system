from io import BytesIO
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Image, KeepTogether, SimpleDocTemplate, Spacer, Table, TableStyle
from app.core.config import settings
from app.pdf.components import text

LAYOUT_VERSION = '2026.1'
WIDTH = A4[0] - 50
CELL = ParagraphStyle('report-cell', fontName='Times-Roman', fontSize=10, leading=13, wordWrap='CJK')
CENTER = ParagraphStyle('report-center', parent=CELL, alignment=1)
BOLD = ParagraphStyle('report-heading', parent=CENTER, fontName='Times-Bold', spaceAfter=7)


def table(values, widths=None, minimum=19):
    result = Table([[text(v, CELL) for v in values]], colWidths=widths or [WIDTH / len(values)] * len(values),
                   minRowHeights=[minimum], splitByRow=1, splitInRow=1)
    result.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), .6, colors.black),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f5f6f7')), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    return result


def authority_snapshot():
    cfg = settings()
    return {'name': cfg.report_signatory_name, 'rank': cfg.report_signatory_rank, 'title': cfg.report_signatory_title}


def generate_report_pdf(data, number=None, version=1, registered_by='', authority=None, preview=False):
    output = BytesIO()
    cfg = settings()
    authority = authority if authority is not None else authority_snapshot()
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=25, rightMargin=25, topMargin=30, bottomMargin=72,
                            title='Relatório Analítico de Ocorrência', author='24º BPM')
    assets = Path(cfg.pdf_asset_dir)
    heading = 'ESTADO DO MARANHÃO\nSECRETARIA DE ESTADO DE SEGURANÇA PÚBLICA\nPOLÍCIA MILITAR DO MARANHÃO\nCOMANDO DO POLICIAMENTO DO INTERIOR\n24º BATALHÃO DE POLÍCIA MILITAR'
    header = Table([[Image(str(assets / 'emblem.png'), width=55, height=48), text(heading, CENTER),
                     Image(str(assets / '24bpm-official.png'), width=64, height=64)]], colWidths=[65, WIDTH-135, 70])
    header.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
    items = [header, Spacer(1, 16), text(f'RELATÓRIO ANALÍTICO DE OCORRÊNCIA {number or "PENDENTE"}', BOLD)]
    date_time = f'{data.occurrence_date:%d/%m/%Y} {data.occurrence_time:%H:%M}'
    rows = [('Código/Tipo de Ocorrência', data.occurrence_type), ('Local', data.location), ('Data / hora', date_time),
            ('Vítima', data.victims), ('Envolvido (s)', data.involved), ('Testemunha (s)', data.witnesses),
            ('Materiais apreendidos', data.seized_material), ('Tipo de arma usada', data.weapon_type),
            ('Outros (veículos, drogas, objetos)', data.others),
            ('Solução da ocorrência', f'EVADIU-SE: {data.fled}    SAMU: {data.samu}    ICRIM: {data.icrim}'),
            ('Causa/Motivo', data.cause), ('Viatura (s) e guarnições envolvidas', data.teams)]
    for label, value in rows:
        if label == 'Solução da ocorrência':
            items.append(table([label, f'EVADIU-SE: {data.fled}', f'SAMU: {data.samu}', f'ICRIM: {data.icrim}'],
                               [180] + [(WIDTH-180)/3]*3))
        else:
            items.append(table([label, value], [180, WIDTH-180], 38 if label.startswith('Viatura') else 19))
    for title, value in [('RELATO DA OCORRÊNCIA', data.narrative), ('PROVIDÊNCIAS ADOTADAS', data.measures)]:
        items.append(Spacer(1, 12))
        title_row = table([title])
        title_row.keepWithNext = True
        items.extend([title_row, table([value], minimum=90)])
    closing = f'LOCAL: {data.closing_location}\nDATA: {data.closing_date.strftime("%d/%m/%Y") if data.closing_date else ""}'
    signer = '\n'.join(filter(None, [' '.join(filter(None, [authority['rank'], authority['name']])), authority['title']]))
    items.extend([Spacer(1, 12), KeepTogether([table([closing, signer], [WIDTH*.4, WIDTH*.6], 55)])])

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.drawString(25, 58, 'PRÉVIA — NÃO EMITIDO' if preview else f'Relatório {number} · Versão {version}')
        canvas.drawRightString(A4[0]-25, 58, f'Página {document.page}')
        registrar = text(f'Registrado por: {registered_by}', ParagraphStyle('registrar-footer', fontName='Helvetica', fontSize=7, leading=8))
        _, height = registrar.wrap(WIDTH, 30)
        registrar.drawOn(canvas, 25, 44-height)
        canvas.setFont('Times-Roman', 8)
        canvas.drawCentredString(A4[0]/2, 17, '24º Batalhão de Polícia Militar · Coroatá/MA')
        canvas.restoreState()
    doc.build(items, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
