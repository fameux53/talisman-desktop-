import enum
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, new_uuid


class CreditEntryType(str, enum.Enum):
    CREDIT_GIVEN = "CREDIT_GIVEN"
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"


class CreditEntry(TimestampMixin, Base):
    __tablename__ = "credit_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), index=True,
    )
    customer_name: Mapped[str] = mapped_column(String(200))
    customer_phone: Mapped[str | None] = mapped_column(String(20))
    entry_type: Mapped[CreditEntryType] = mapped_column()
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    balance_after: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    description: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column()
    reminder_sent: Mapped[bool] = mapped_column(default=False)
