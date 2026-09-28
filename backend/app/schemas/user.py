from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Login(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class UserCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: EmailStr
    name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=12, max_length=128)
    role: Literal['ADMIN', 'OPERADOR'] = 'OPERADOR'


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    active: bool | None = None
    role: Literal['ADMIN', 'OPERADOR'] | None = None
    password: str | None = Field(default=None, min_length=12, max_length=128)
