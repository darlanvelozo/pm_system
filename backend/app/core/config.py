from functools import lru_cache
from typing import Literal
from pydantic import EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str
    jwt_secret: str
    battalion_email: EmailStr = 'boletimonline24bpm@gmail.com'
    email_provider: Literal['smtp', 'gmail_api'] = 'smtp'
    gmail_client_id: str = ''
    gmail_client_secret: str = ''
    gmail_refresh_token: str = ''
    gmail_from: str = 'boletimonline24bpm@gmail.com'
    smtp_host: str = ''
    smtp_port: int = 587
    smtp_username: str = ''
    smtp_password: str = ''
    smtp_from: str = ''
    smtp_ssl: bool = False
    allowed_origins: str = 'http://localhost:3000'
    environment: str = 'development'
    token_minutes: int = 30
    pdf_asset_dir: str = 'app/pdf/assets'

    @field_validator('jwt_secret')
    @classmethod
    def secure_secret(cls, value):
        if len(value) < 32:
            raise ValueError('JWT_SECRET precisa de pelo menos 32 caracteres aleatórios')
        return value

    @property
    def origins(self):
        origins = [item.strip().rstrip('/') for item in self.allowed_origins.split(',') if item.strip()]
        if not origins or '*' in origins:
            raise ValueError('Configure origens explícitas')
        if self.environment == 'production' and any(not x.startswith('https://') for x in origins):
            raise ValueError('Produção requer origens HTTPS')
        return origins


@lru_cache
def settings():
    return Settings()
