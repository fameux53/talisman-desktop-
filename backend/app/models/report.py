import enum
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, new_uuid


class ReportType(str, enum.Enum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"


class Report(TimestampMixin, Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), index=True,
    )
    report_type: Mapped[ReportType] = mapped_column()
    period_start: Mapped[date] = mapped_column()
    period_end: Mapped[date] = mapped_column()
    total_revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    net_profit: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    report_image_url: Mapped[str | None] = mapped_column(String(500))
