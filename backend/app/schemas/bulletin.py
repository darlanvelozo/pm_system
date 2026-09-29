from datetime import date as Date, time as Time
from enum import StrEnum
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator, field_validator


class BulletinType(StrEnum):
    DYNAMIC = 'DYNAMIC'
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
    id: UUID | None = None
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

    @field_validator('cpf')
    @classmethod
    def valid_cpf(cls, value):
        if not value:
            return value
        digits = ''.join(c for c in value if c.isdigit())
        if len(digits) != 11 or len(set(digits)) == 1 or any(c not in '0123456789.-' for c in value):
            raise ValueError('CPF inválido')
        for length in (9, 10):
            check = (sum(int(digits[i]) * (length + 1 - i) for i in range(length)) * 10 % 11) % 10
            if check != int(digits[length]):
                raise ValueError('CPF inválido')
        return value


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

    bulletin_type: BulletinType = BulletinType.DYNAMIC
    recipient_email: EmailStr
    bo_number: str = Field(min_length=1, max_length=100, pattern=r'^[^\r\n]+$')
    dispatch_number: str = ''
    occurrence_type: str = Field(min_length=1, max_length=200)
    occurrence_date: Date
    occurrence_time: Time
    location: Location
    people: list[Person] = Field(min_length=1)
    history: str = Field(min_length=1, max_length=40000)
    seized_material: str = Field(default='', max_length=20000)
    team: list[Team] = Field(min_length=1)
    delivery: Delivery = Field(default_factory=Delivery)


class DraftLocation(Location):
    street: str = ''
    city: str = ''


class DraftBulletin(BulletinInput):
    recipient_email: EmailStr | Literal[''] = ''
    occurrence_type: str = ''
    occurrence_date: Date | None = None
    occurrence_time: Time | None = None
    location: DraftLocation = Field(default_factory=DraftLocation)
    history: str = Field(default='', max_length=40000)


class CreateBulletin(FormModel):
    data: DraftBulletin
    emit: bool = False

    @model_validator(mode='after')
    def validate_emission(self):
        if self.emit:
            self.data = BulletinInput.model_validate(self.data.model_dump())
        return self


class UpdateBulletin(CreateBulletin):
    version: int = Field(ge=1)


class RevisionInput(FormModel):
    data: BulletinInput
    version: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=500)


class ResendInput(FormModel):
    target: Literal['recipient', 'battalion', 'both'] = 'both'
