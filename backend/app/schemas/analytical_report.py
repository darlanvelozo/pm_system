from datetime import date, time
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ReportDraft(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    recipient_email: str = Field(default='', max_length=254)
    occurrence_type: str = Field(default='', max_length=200)
    location: str = Field(default='', max_length=2000)
    occurrence_date: date | None = None
    occurrence_time: time | None = None
    victims: str = Field(default='', max_length=20000)
    involved: str = Field(default='', max_length=20000)
    witnesses: str = Field(default='', max_length=20000)
    seized_material: str = Field(default='', max_length=20000)
    weapon_type: str = Field(default='', max_length=500)
    others: str = Field(default='', max_length=20000)
    fled: Literal['SIM', 'NÃO', ''] = ''
    samu: Literal['SIM', 'NÃO', ''] = ''
    icrim: Literal['SIM', 'NÃO', ''] = ''
    cause: str = Field(default='', max_length=20000)
    teams: str = Field(default='', max_length=20000)
    narrative: str = Field(default='', max_length=80000)
    measures: str = Field(default='', max_length=80000)
    closing_location: str = Field(default='', max_length=200)
    closing_date: date | None = None
    draft_step: int = Field(default=0, ge=0, le=7)


class ReportInput(ReportDraft):
    recipient_email: EmailStr
    occurrence_type: str = Field(min_length=1, max_length=200)
    location: str = Field(min_length=1, max_length=2000)
    occurrence_date: date
    occurrence_time: time
    fled: Literal['SIM', 'NÃO']
    samu: Literal['SIM', 'NÃO']
    icrim: Literal['SIM', 'NÃO']
    narrative: str = Field(min_length=1, max_length=80000)
    measures: str = Field(min_length=1, max_length=80000)


class CreateReport(BaseModel):
    data: ReportDraft


class UpdateReport(CreateReport):
    version: int = Field(ge=1)


class ReviseReport(BaseModel):
    data: ReportInput
    version: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=500)
