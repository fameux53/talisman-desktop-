import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.utils.sanitize import sanitize_text


class ProductCreate(BaseModel):
    name: str = Field(..., max_length=200)
    name_creole: str | None = Field(None, max_length=200)
    unit: str = Field(..., max_length=50)
    current_price: Decimal = Field(..., ge=0)
    stock_quantity: Decimal = Field(..., ge=0)
    low_stock_threshold: Decimal = Field(default=Decimal("5"), ge=0)

    @field_validator("name", "unit")
    @classmethod
    def _sanitize(cls, v: str) -> str:
        return sanitize_text(v)

    @field_validator("name_creole")
    @classmethod
    def _sanitize_opt(cls, v: str | None) -> str | None:
        return sanitize_text(v) if v else v


class ProductUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    name_creole: str | None = None
    unit: str | None = Field(None, max_length=50)
    current_price: Decimal | None = Field(None, ge=0)
    stock_quantity: Decimal | None = Field(None, ge=0)
    low_stock_threshold: Decimal | None = Field(None, ge=0)

    @field_validator("name", "unit")
    @classmethod
    def _sanitize(cls, v: str | None) -> str | None:
        return sanitize_text(v) if v else v

    @field_validator("name_creole")
    @classmethod
    def _sanitize_opt(cls, v: str | None) -> str | None:
        return sanitize_text(v) if v else v


class ProductOut(BaseModel):
    id: uuid.UUID
    vendor_id: uuid.UUID
    name: str
    name_creole: str | None
    unit: str
    current_price: Decimal
    stock_quantity: Decimal
    low_stock_threshold: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
