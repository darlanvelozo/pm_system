from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate
from app.pdf.layout import build


def generate_pdf(data, registered_by=None, version=1, bulletin_id=None, preview=False, unit=None):
    from app.services.system_settings import effective_settings
    unit = unit or effective_settings()
    if preview:
        data = data.model_copy(update={'bo_number': 'PENDENTE'})
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=10, rightMargin=10, topMargin=48, bottomMargin=70,
                            title='Boletim de Ocorrência – PMMA', author=unit['unit_short_name'])

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        from reportlab.lib.utils import simpleSplit
        canvas.drawString(16, A4[1]-14, 'BOLETIM DE OCORRÊNCIA – PMMA')
        if document.page > 1:
            canvas.drawRightString(A4[0]-16, A4[1]-14, 'CONTINUAÇÃO — ENVOLVIDOS / REGISTRO')
        for index, line in enumerate(simpleSplit(f'Nº DO BO: {data.bo_number}', 'Helvetica', 8, A4[0]-32)):
            canvas.drawString(16, A4[1]-26-index*9, line)
        canvas.setFont('Helvetica', 7)
        canvas.drawString(12, 48, 'PRÉVIA — NÃO EMITIDO' if preview else f'Versão {version} — verificação autenticada')
        if bulletin_id and not preview:
            from reportlab.graphics.barcode.qr import QrCodeWidget
            from reportlab.graphics.shapes import Drawing
            from reportlab.graphics import renderPDF
            from app.core.config import settings
            qr = QrCodeWidget(f'{settings().frontend_url.rstrip("/")}/verificar/{bulletin_id}?revision={version}')
            x1, y1, x2, y2 = qr.getBounds()
            drawing = Drawing(44, 44, transform=[44/(x2-x1), 0, 0, 44/(y2-y1), 0, 0])
            drawing.add(qr)
            renderPDF.draw(drawing, canvas, A4[0]-58, 22)
        if registered_by:
            lines = simpleSplit(f'Registrado por: {registered_by}', 'Helvetica', 7, A4[0]-130)
            for index, line in enumerate(reversed(lines)):
                canvas.drawString(12, 10 + index * 8, line)
        canvas.drawRightString(A4[0]-12, 10, f'{unit["unit_short_name"]} • Página {document.page}')
        canvas.restoreState()

    doc.build(build(data), onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
