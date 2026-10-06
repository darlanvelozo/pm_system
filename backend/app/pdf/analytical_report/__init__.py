from html import escape
from io import BytesIO
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import CondPageBreak, Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from app.core.config import settings
from app.pdf.components import text
from app.services.system_settings import authority, effective_settings

LAYOUT_VERSION = '2026.2'
WIDTH = A4[0] - 50
CELL = ParagraphStyle('report-cell', fontName='Times-Roman', fontSize=10, leading=13)
CENTER = ParagraphStyle('report-center', parent=CELL, alignment=1)
BOLD = ParagraphStyle('report-heading', parent=CENTER, fontName='Times-Bold', spaceAfter=7)
SECTION = ParagraphStyle('report-section', parent=CENTER, fontName='Times-Bold', fontSize=11)
HEADER = ParagraphStyle('report-header', parent=CENTER, fontSize=11, leading=13.5)
HEADER_BOLD = ParagraphStyle('report-header-bold', parent=HEADER, fontName='Times-Bold')
GRAY = colors.HexColor('#6b6b6b')


def table(values, widths=None, minimum=19, rows=None):
    result = Table(rows or [[v if isinstance(v, (list, Paragraph)) else text(v, CELL) for v in values]],
                   colWidths=widths or [WIDTH / len(values)] * len(values), minRowHeights=minimum if rows else [minimum],
                   splitByRow=1, splitInRow=1)
    # White cells, as in the battalion's current model.
    result.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), .6, colors.black), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    return result


def authority_snapshot(db=None):
    return authority(effective_settings(db))


def signature_image(content, max_width=150, max_height=45):
    width, height = ImageReader(BytesIO(content)).getSize()
    scale = min(max_width / width, max_height / height)
    return Image(BytesIO(content), width=width * scale, height=height * scale)


def generate_report_pdf(data, number=None, version=1, registered_by='', authority=None, preview=False, unit=None, signature=None):
    output = BytesIO()
    cfg = settings()
    unit = unit or effective_settings()
    authority = authority if authority is not None else authority_snapshot()
    footer_lines = [line for line in (unit.get('footer_address'), unit.get('footer_contact')) if line]
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=25, rightMargin=25, topMargin=24,
                            bottomMargin=92 if footer_lines else 72,
                            title='Relatório Analítico de Ocorrência', author=unit['unit_short_name'])
    assets = Path(cfg.pdf_asset_dir)
    heading = [Image(str(assets / 'brasao-maranhao.png'), width=50, height=31), Spacer(1, 3),
               text('ESTADO DO MARANHÃO\nSECRETARIA DE ESTADO DE SEGURANÇA PÚBLICA\nPOLÍCIA MILITAR DO MARANHÃO\n'
                    'COMANDO DO POLICIAMENTO DO INTERIOR', HEADER), text('24º BATALHÃO DE POLÍCIA MILITAR', HEADER_BOLD)]
    header = Table([[Image(str(assets / 'pmma-190-anos.jpg'), width=62, height=62), heading,
                     Image(str(assets / '24bpm-official.png'), width=64, height=64)]], colWidths=[75, WIDTH-150, 75])
    header.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    title = escape(f'RELATÓRIO ANALÍTICO DE OCORRÊNCIA {number or "PENDENTE"}')
    items = [header, Spacer(1, 14), Paragraph(f'<u>{title}</u>', BOLD), Spacer(1, 4)]
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
        # Heading and text share one table so the text starts right below it, on the same page when there is room.
        items.extend([Spacer(1, 12), CondPageBreak(60),
                      table([title], minimum=[19, 90], rows=[[text(title, SECTION)], [text(value, CELL)]])])
    closing = '\n'.join([f'LOCAL: {data.closing_location}', f'DATA: {data.closing_date.strftime("%d/%m/%Y") if data.closing_date else ""}',
                          f'{data.occurrence_time:%H:%M:%S}' if data.occurrence_time else ''])
    signer = [text(line, CENTER) for line in (' '.join(filter(None, [authority['rank'], authority['name']])), authority['title']) if line]
    if signature:
        signer.insert(0, signature_image(signature))
    closing_table = table([closing, signer or ''], [WIDTH*.4, WIDTH*.6], 62)
    closing_table.setStyle(TableStyle([('ALIGN', (1, 0), (1, 0), 'CENTER'), ('VALIGN', (1, 0), (1, 0), 'MIDDLE')]))
    items.extend([Spacer(1, 12), KeepTogether([closing_table])])

    def footer(canvas, document):
        canvas.saveState()
        registrar = text(f'Registrado por: {registered_by}', ParagraphStyle('registrar-footer', fontName='Helvetica', fontSize=7, leading=8))
        _, height = registrar.wrap(WIDTH, 30)
        # Model footer (rule + address lines) when configured; otherwise the original "unit · city" line.
        status_y = 58 + height + 2 if footer_lines else 58
        canvas.setFont('Helvetica', 8)
        canvas.drawString(25, status_y, 'PRÉVIA — NÃO EMITIDO' if preview else f'Relatório {number} · Versão {version}')
        canvas.drawRightString(A4[0]-25, status_y, f'Página {document.page}')
        registrar.drawOn(canvas, 25, (56 if footer_lines else 44) - (0 if footer_lines else height))
        if footer_lines:
            canvas.setLineWidth(1.4)
            canvas.line(45, 46, A4[0]-45, 46)
            canvas.setFont('Helvetica', 8.5)
            canvas.setFillColor(GRAY)
            for index, line in enumerate(footer_lines):
                canvas.drawCentredString(A4[0]/2, 32 - index * 11, line)
        else:
            canvas.setFont('Times-Roman', 8)
            canvas.drawCentredString(A4[0]/2, 17, ' · '.join(filter(None, [unit['unit_name'], unit['unit_city']])))
        canvas.restoreState()
    doc.build(items, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
