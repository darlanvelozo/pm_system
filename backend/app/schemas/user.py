from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator, field_validator


class Login(BaseModel):
    username: str | None = Field(default=None, min_length=1, max_length=254)
    email: EmailStr | None = None
    password: str = Field(min_length=1, max_length=256)

    @model_validator(mode='after')
    def require_login(self):
        if not (self.username or self.email):
            raise ValueError('Informe o usuário')
        return self


class UserCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    username: str | None = Field(default=None, min_length=3, max_length=64, pattern=r'^[a-zA-Z0-9_.-]+$')
    email: EmailStr | None = None
    name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=12, max_length=128)
    role: Literal['ADMIN', 'OPERADOR'] = 'OPERADOR'

    @field_validator('username')
    @classmethod
    def normalize_username(cls, value):
        return value.lower() if value else value

    @model_validator(mode='after')
    def require_identity(self):
        if not (self.username or self.email):
            raise ValueError('Informe o usuário')
        return self


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str | None = Field(default=None, min_length=1, max_length=150)
    username: str | None = Field(default=None, min_length=3, max_length=64, pattern=r'^[a-zA-Z0-9_.-]+$')
    active: bool | None = None
    role: Literal['ADMIN', 'OPERADOR'] | None = None
    password: str | None = Field(default=None, min_length=12, max_length=128)

    @field_validator('password', mode='before')
    @classmethod
    def empty_password(cls, value):
        return value or None

    @field_validator('username')
    @classmethod
    def normalize(cls, value):
        return value.lower() if value else value
