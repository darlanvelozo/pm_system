from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate
from app.pdf.templates import two_involved, four_involved
from app.schemas.bulletin import BulletinType


def generate_pdf(data):
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=10, rightMargin=10, topMargin=15, bottomMargin=20,
                            title='Boletim de Ocorrência – PMMA', author='24º BPM')
    template = two_involved if data.bulletin_type == BulletinType.TWO_INVOLVED else four_involved

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont('Helvetica', 7)
        canvas.drawRightString(A4[0]-12, 10, f'24º BPM • Página {document.page}')
        canvas.restoreState()

    doc.build(template.build(data), onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
