from html import escape
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Image, Paragraph, Table, TableStyle
from app.core.config import settings

WIDTH = 563
STYLE = ParagraphStyle('cell', fontName='Helvetica', fontSize=8, leading=10)
BODY = ParagraphStyle('body', parent=STYLE, fontSize=10, leading=14, spaceAfter=4)


def text(value='', style=STYLE):
    return Paragraph(escape(str(value or '')).replace('\n', '<br/>'), style)


def row(values, widths=None, height=None, gray=False):
    table = Table([[v if isinstance(v, (Paragraph, Image, Table)) else text(v) for v in values]],
                  colWidths=[WIDTH * v for v in widths] if widths else [WIDTH / len(values)] * len(values),
                  minRowHeights=[height or 19], splitByRow=1, splitInRow=1)
    table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), .6, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#bfbfbf') if gray else colors.white),
    ]))
    return table


def heading(title):
    title_style = ParagraphStyle('heading', parent=STYLE, fontName='Helvetica-Bold')
    result = row([text(title, title_style)], gray=True, height=19)
    result.keepWithNext = True
    return result


def header(data):
    assets = Path(settings().pdf_asset_dir)
    flag = Image(str(assets / 'flag.png'), width=45, height=30)
    emblem = Image(str(assets / 'emblem.png'), width=30, height=30)
    return [row([flag, 'BOLETIM DE OCORRÊNCIA – PMMA\nESTADO DO MARANHÃO', f'Nº DO BO: {data.bo_number}\nNº DO DESPACHO: {data.dispatch_number}', emblem], [.1, .34, .48, .08]),
            row([f'Tipo de Ocorrência: {data.occurrence_type}', f'Data: {data.occurrence_date:%d/%m/%Y}', f'Hora: {data.occurrence_time:%H:%M}'], [.62, .2, .18])]


def location(data):
    d = data.location
    return [heading('LOCAL'), row([f'Logradouro: {d.street}', f'Nº: {d.number}'], [.82, .18]),
            row([f'Bairro: {d.neighborhood}', f'Complemento: {d.complement}', f'CEP: {d.zip_code}'], [.46, .34, .2]),
            row([f'Referência: {d.reference}']), row([f'Município: {d.city}', f'Tipo de Local: {d.location_type}'])]


def checks(options, selected):
    return '    '.join(f'[{"X" if item in selected else "  "}] {item}' for item in options)


def involved(person, position, extra=False):
    p = person
    roles = ['Autor', 'Suspeito', 'Vítima', 'Testemunha', 'Comunicante', 'Vítima Fatal']
    items = [heading(f'ENVOLVIDO “{position}”   ' + checks(roles, [p.role])),
        row([f'Nome: {p.name}', f'Sexo: {p.gender}', f'Data nascimento: {p.birth_date.strftime("%d/%m/%Y") if p.birth_date else ""}'], [.65, .15, .2]),
        row([f'Endereço: {p.address}', f'Município: {p.city}', f'Tel: {p.phone}'], [.48, .32, .2]),
        row([f'Mãe: {p.mother_name}', f'CPF: {p.cpf}'], [.8, .2]),
        row([f'Motivação: {p.motivation}', f'RG: {p.rg}'], [.8, .2]),
        row(['Características Físicas', f'Olhos: {p.eyes}', f'Cabelos: {p.hair}', f'Pele: {p.skin}', f'Barba: {p.beard}'], [.24, .19, .19, .19, .19]),
        row([f'Cicatriz: {p.scar}', f'Compleição: {p.build}', f'Altura: {p.height}']),
        row([f'Tatuagem: {p.tattoo}', f'Adereço: {p.accessory}']),
        row([f'Características Marcantes: {p.distinguishing_features}']),
        row(['Lesão: ' + checks(['Leve', 'Grave', 'Gravíssima', 'Ileso'], [p.injury_level]), f'Obs: {p.injury_notes}'], [.56, .44])]
    items.append(row([f'Observação: {p.observations}']))
    if extra:
        from app.schemas.bulletin import TwoExtras
        e = p.extras or TwoExtras()
        items.extend([row([f'Vestimentas: {e.clothing}']),
            row(['Meios de Locomoção: ' + checks(['Automóvel', 'Motocicleta', 'Bicicleta', 'Animal', 'A pé', 'Outros'], e.transportation) + ' ' + e.transportation_notes])])
        for label, obj, fields in [
            ('Arma de fogo', e.firearm, [('Tipo','type'), ('Nº','number'), ('Marca','brand'), ('Calibre','caliber')]),
            ('Droga', e.drug, [('Tipo','type'), ('Quantidade','quantity'), ('Embalagem','packaging')]),
            ('Veículo', e.vehicle, [('Marca/modelo','brand_model'), ('Placa','plate'), ('Cor','color'), ('Ano','year')]),
            ('Arma branca', e.melee_weapon, [('Tipo','type'), ('Quantidade','quantity')]),
        ]:
            items.append(row([f'[{"X" if obj.selected else "  "}] {label}'] + [f'{title}: {getattr(obj, key)}' for title,key in fields], [.19] + [.81 / len(fields)] * len(fields)))
    return items


def narrative(title, value, minimum):
    # Long paragraphs split across pages within a bordered table cell.
    return [heading(title), row([text(value, BODY)], height=minimum)]


def ending(data):
    result = [heading('EFETIVO EMPENHADO')]
    for t in data.team:
        result.append(row([f'VTR: {t.vehicle}', f'Posto/Graduação/Nome Cmt: {t.commander_name}', f'Mat: {t.commander_registration}', f'Posto/Patru: {t.patrol_officer_name}', f'Mat: {t.patrol_officer_registration}'], [.15, .3, .15, .25, .15], height=22))
    d = data.delivery
    result.extend([heading('UNIDADE DE ENTREGA'),
        row([f'Unidade: {d.unit}', f'Data: {d.date.strftime("%d/%m/%Y") if d.date else "___/___/______"}', f'Hora: {d.time.strftime("%H:%M") if d.time else "___:___"}'], [.6, .22, .18]),
        row([f'Mat: {d.registration}', f'Nome: {d.name}', 'Ass: _________________________'], [.2, .43, .37])])
    return result
