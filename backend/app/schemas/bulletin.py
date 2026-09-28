from datetime import date as Date, time as Time
from enum import StrEnum
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class BulletinType(StrEnum):
    TWO_INVOLVED = 'TWO_INVOLVED'
    FOUR_INVOLVED = 'FOUR_INVOLVED'


class FormModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, str_max_length=500)


class Firearm(FormModel):
    selected: bool = False
    type: str = ''
    number: str = ''
    brand: str = ''
    caliber: str = ''


class Drug(FormModel):
    selected: bool = False
    type: str = ''
    quantity: str = ''
    packaging: str = ''


class Vehicle(FormModel):
    selected: bool = False
    brand_model: str = ''
    plate: str = ''
    color: str = ''
    year: str = ''


class MeleeWeapon(FormModel):
    selected: bool = False
    type: str = ''
    quantity: str = ''


class TwoExtras(FormModel):
    clothing: str = ''
    transportation: list[Literal['Automóvel', 'Motocicleta', 'Bicicleta', 'Animal', 'A pé', 'Outros']] = Field(default_factory=list, max_length=6)
    transportation_notes: str = ''
    firearm: Firearm = Field(default_factory=Firearm)
    drug: Drug = Field(default_factory=Drug)
    vehicle: Vehicle = Field(default_factory=Vehicle)
    melee_weapon: MeleeWeapon = Field(default_factory=MeleeWeapon)


class Person(FormModel):
    role: Literal['', 'Autor', 'Suspeito', 'Vítima', 'Testemunha', 'Comunicante', 'Vítima Fatal'] = ''
    name: str = ''
    gender: str = ''
    birth_date: Date | None = None
    address: str = ''
    city: str = ''
    phone: str = ''
    mother_name: str = ''
    cpf: str = Field(default='', max_length=14)
    motivation: str = ''
    rg: str = ''
    eyes: str = ''
    hair: str = ''
    skin: str = ''
    beard: str = ''
    scar: str = ''
    build: str = ''
    height: str = ''
    tattoo: str = ''
    accessory: str = ''
    distinguishing_features: str = ''
    injury_level: Literal['', 'Leve', 'Grave', 'Gravíssima', 'Ileso'] = ''
    injury_notes: str = ''
    observations: str = ''
    extras: TwoExtras | None = None


class Location(FormModel):
    street: str = Field(min_length=1)
    number: str = ''
    neighborhood: str = ''
    complement: str = ''
    zip_code: str = Field(default='', max_length=9)
    reference: str = ''
    city: str = Field(min_length=1)
    location_type: str = ''


class Team(FormModel):
    vehicle: str = ''
    commander_name: str = ''
    commander_registration: str = ''
    patrol_officer_name: str = ''
    patrol_officer_registration: str = ''


class Delivery(FormModel):
    unit: str = ''
    date: Date | None = None
    time: Time | None = None
    registration: str = ''
    name: str = ''


class BulletinInput(FormModel):
    # Only this legacy/untrusted key is discarded. All other unknown fields fail.
    @model_validator(mode='before')
    @classmethod
    def ignore_institutional_address(cls, value):
        if isinstance(value, dict):
            value = {k: v for k, v in value.items() if k not in {'battalionEmail', 'battalion_email'}}
        return value

    bulletin_type: BulletinType
    recipient_email: EmailStr
    bo_number: str = Field(min_length=1, max_length=100, pattern=r'^[^\r\n]+$')
    dispatch_number: str = ''
    occurrence_type: str = Field(min_length=1, max_length=200)
    occurrence_date: Date
    occurrence_time: Time
    location: Location
    people: list[Person] = Field(min_length=2, max_length=4)
    history: str = Field(min_length=1, max_length=40000)
    seized_material: str = Field(default='', max_length=20000)
    team: list[Team] = Field(min_length=1, max_length=20)
    delivery: Delivery = Field(default_factory=Delivery)

    @model_validator(mode='after')
    def check_profile(self):
        expected = 2 if self.bulletin_type == BulletinType.TWO_INVOLVED else 4
        if len(self.people) != expected:
            raise ValueError(f'O modelo requer exatamente {expected} posições de envolvidos')
        if expected == 4 and any(p.extras is not None for p in self.people):
            raise ValueError('Modelo BO 04 não admite campos exclusivos do BO 02')
        return self


class CreateBulletin(FormModel):
    data: BulletinInput
    emit: bool = False


class UpdateBulletin(CreateBulletin):
    version: int = Field(ge=1)


class ResendInput(FormModel):
    target: Literal['recipient', 'battalion', 'both'] = 'both'
