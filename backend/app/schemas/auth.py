import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.vendor import PreferredLanguage
from app.utils.sanitize import sanitize_text

# Common PINs that are too easy to guess
_BLOCKED_PINS = {
    "000000", "111111", "222222", "333333", "444444",
    "555555", "666666", "777777", "888888", "999999",
    "123456", "654321", "012345", "543210",
}


# -- requests ----------------------------------------------------------------

class RegisterRequest(BaseModel):
    phone_number: str = Field(..., max_length=20)
    display_name: str = Field(..., min_length=2, max_length=100)
    pin: str = Field(..., pattern=r"^\d{6}$")
    preferred_language: PreferredLanguage = PreferredLanguage.HT

    @field_validator("display_name")
    @classmethod
    def _sanitize_display_name(cls, v: str) -> str:
        v = sanitize_text(v)
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v

    @field_validator("phone_number")
    @classmethod
    def _sanitize_phone(cls, v: str) -> str:
        return sanitize_text(v)

    @field_validator("pin")
    @classmethod
    def _check_pin_blocklist(cls, v: str) -> str:
        if v in _BLOCKED_PINS:
            raise ValueError("PIN is too simple")
        return v


class CheckPhoneRequest(BaseModel):
    phone_number: str


class LoginRequest(BaseModel):
    phone_number: str
    pin: str
    employee_id: str | None = None  # Set when logging in as an employee
    role: str | None = None  # 'owner' | 'manager' | 'assistant'


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPinRequest(BaseModel):
    phone_number: str


class VerifyResetCode(BaseModel):
    phone_number: str
    code: str = Field(..., pattern=r"^\d{6}$")


class ResetPinRequest(BaseModel):
    reset_token: str
    new_pin: str = Field(..., pattern=r"^\d{6}$")

    @field_validator("new_pin")
    @classmethod
    def _check_pin_blocklist(cls, v: str) -> str:
        if v in _BLOCKED_PINS:
            raise ValueError("PIN is too simple")
        return v


class SecurityQuestionReset(BaseModel):
    phone_number: str
    security_answer: str
    new_pin: str = Field(..., pattern=r"^\d{6}$")

    @field_validator("new_pin")
    @classmethod
    def _check_pin_blocklist(cls, v: str) -> str:
        if v in _BLOCKED_PINS:
            raise ValueError("PIN is too simple")
        return v


# -- responses ---------------------------------------------------------------

class VendorOut(BaseModel):
    id: uuid.UUID
    phone_number: str
    display_name: str
    preferred_language: PreferredLanguage
    market_zone: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
