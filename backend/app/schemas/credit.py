import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.models.credit import CreditEntryType
from app.utils.sanitize import sanitize_text


class CreditCreate(BaseModel):
    customer_name: str = Field(..., max_length=200)
    customer_phone: str | None = Field(None, max_length=20)
    entry_type: CreditEntryType
    amount: Decimal = Field(..., gt=0)
    description: str | None = None
    due_date: date | None = None

    @field_validator("customer_name")
    @classmethod
    def _sanitize_name(cls, v: str) -> str:
        return sanitize_text(v)

    @field_validator("customer_phone")
    @classmethod
    def _sanitize_phone(cls, v: str | None) -> str | None:
        return sanitize_text(v) if v else v

    @field_validator("description")
    @classmethod
    def _sanitize_desc(cls, v: str | None) -> str | None:
        return sanitize_text(v) if v else v


class CreditUpdate(BaseModel):
    entry_type: CreditEntryType | None = None
    amount: Decimal | None = Field(None, gt=0)
    description: str | None = None
    due_date: date | None = None
    reminder_sent: bool | None = None

    @field_validator("description")
    @classmethod
    def _sanitize_desc(cls, v: str | None) -> str | None:
        return sanitize_text(v) if v else v


class CreditOut(BaseModel):
    id: uuid.UUID
    vendor_id: uuid.UUID
    customer_name: str
    customer_phone: str | None
    entry_type: CreditEntryType
    amount: Decimal
    balance_after: Decimal
    description: str | None
    due_date: date | None
    reminder_sent: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CustomerBalance(BaseModel):
    customer_name: str
    customer_phone: str | None
    balance: Decimal
    entries: list[CreditOut]


class CreditSummary(BaseModel):
    total_outstanding: Decimal
    unique_customers: int
    overdue_entries: int
