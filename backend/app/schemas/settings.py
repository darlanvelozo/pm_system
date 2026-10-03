from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

TEXT = r'^[^\x00-\x1f\x7f<>]*$'


class SettingsUpdate(BaseModel):
    """Empty or missing values fall back to the server (environment) defaults."""
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    unit_name: str | None = Field(default=None, max_length=150, pattern=TEXT)
    unit_short_name: str | None = Field(default=None, max_length=60, pattern=TEXT)
    unit_city: str | None = Field(default=None, max_length=100, pattern=TEXT)
    battalion_email: EmailStr | None = Field(default=None, max_length=254)
    reply_to_email: EmailStr | None = Field(default=None, max_length=254)
    signatory_name: str | None = Field(default=None, max_length=150, pattern=TEXT)
    signatory_rank: str | None = Field(default=None, max_length=100, pattern=TEXT)
    signatory_title: str | None = Field(default=None, max_length=150, pattern=TEXT)

    @field_validator('*', mode='before')
    @classmethod
    def blank(cls, value):
        if isinstance(value, str):
            value = value.strip()
        return value or None


class TestEmail(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: EmailStr = Field(max_length=254)
