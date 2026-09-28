from reportlab.platypus import PageBreak
from app.pdf.components import header, location, involved, narrative, ending


def build(data):
    story = header(data) + location(data)
    for index, person in enumerate(data.people):
        story.extend(involved(person, index, extra=True))
    story.append(PageBreak())
    story.extend(narrative('Histórico', data.history, 245))
    story.extend(narrative('Material Apreendido', data.seized_material, 215))
    return story + ending(data)
