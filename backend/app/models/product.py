import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, new_uuid


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id", ondelete="CASCADE"), index=True,
    )
    name: Mapped[str] = mapped_column(String(200))
    name_creole: Mapped[str | None] = mapped_column(String(200))
    unit: Mapped[str] = mapped_column(String(50))
    current_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    stock_quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    low_stock_threshold: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=5)
    is_active: Mapped[bool] = mapped_column(default=True)
