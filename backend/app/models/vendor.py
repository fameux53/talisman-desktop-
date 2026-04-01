import enum
import uuid
from datetime import datetime

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, new_uuid


class PreferredLanguage(str, enum.Enum):
    HT = "HT"
    FR = "FR"
    EN = "EN"


class Vendor(TimestampMixin, Base):
    __tablename__ = "vendors"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(100))
    pin_hash: Mapped[str] = mapped_column(String(255))
    preferred_language: Mapped[PreferredLanguage] = mapped_column(
        default=PreferredLanguage.HT,
    )
    market_zone: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True)
    failed_login_attempts: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column()
    security_question: Mapped[str | None] = mapped_column(String(200))
    security_answer_hash: Mapped[str | None] = mapped_column(String(255))
