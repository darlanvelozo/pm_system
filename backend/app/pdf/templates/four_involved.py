from reportlab.platypus import PageBreak
from app.pdf.components import header, location, involved, narrative, ending


def build(data):
    story = header(data) + location(data)
    for index, person in enumerate(data.people):
        if index == 3:
            story.append(PageBreak())
        story.extend(involved(person, index))
    story.extend(narrative('Histórico', data.history, 215))
    story.extend(narrative('Material Apreendido', data.seized_material, 135))
    return story + ending(data)
