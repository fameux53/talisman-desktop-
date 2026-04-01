import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.models.transaction import TransactionType
from app.utils.sanitize import sanitize_text


class TransactionCreate(BaseModel):
    product_id: uuid.UUID | None = None
    transaction_type: TransactionType
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    total_amount: Decimal = Field(..., ge=0)
    notes: str | None = None
    recorded_offline: bool = False
    synced_at: datetime | None = None

    @field_validator("notes")
    @classmethod
    def _sanitize_notes(cls, v: str | None) -> str | None:
        return sanitize_text(v) if v else v


class TransactionOut(BaseModel):
    id: uuid.UUID
    vendor_id: uuid.UUID
    product_id: uuid.UUID | None
    transaction_type: TransactionType
    quantity: Decimal
    unit_price: Decimal
    total_amount: Decimal
    notes: str | None
    recorded_offline: bool
    synced_at: datetime | None
    created_at: datetime
    updated_at: datetime
    low_stock_warning: str | None = None

    model_config = {"from_attributes": True}


class TransactionFilter(BaseModel):
    type: TransactionType | None = None
    date_from: date | None = None
    date_to: date | None = None
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


class BulkTransactionItem(BaseModel):
    product_id: uuid.UUID | None = None
    transaction_type: TransactionType
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)
    total_amount: Decimal = Field(..., ge=0)
    notes: str | None = None
    recorded_offline: bool = True
    synced_at: datetime | None = None

    @field_validator("notes")
    @classmethod
    def _sanitize_notes(cls, v: str | None) -> str | None:
        return sanitize_text(v) if v else v


class BulkResultItem(BaseModel):
    index: int
    success: bool
    transaction: TransactionOut | None = None
    error: str | None = None


class BulkTransactionResponse(BaseModel):
    results: list[BulkResultItem]
