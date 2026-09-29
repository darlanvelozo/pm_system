from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate
from app.pdf.layout import build


def generate_pdf(data, registered_by=None):
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=10, rightMargin=10, topMargin=48, bottomMargin=42,
                            title='Boletim de Ocorrência – PMMA', author='24º BPM')

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
        if registered_by:
            lines = simpleSplit(f'Registrado por: {registered_by}', 'Helvetica', 7, A4[0]-130)
            for index, line in enumerate(reversed(lines)):
                canvas.drawString(12, 10 + index * 8, line)
        canvas.drawRightString(A4[0]-12, 10, f'24º BPM • Página {document.page}')
        canvas.restoreState()

    doc.build(build(data), onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
