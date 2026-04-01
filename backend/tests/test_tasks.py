"""Tests for Celery tasks using task_always_eager + SQLite."""

import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.credit import CreditEntry, CreditEntryType
from app.models.report import Report
from app.models.transaction import Transaction, TransactionType
from app.models.vendor import PreferredLanguage, Vendor
from app.utils.security import hash_pin

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_vendor(db: AsyncSession, phone: str = "+50938001111") -> Vendor:
    vendor = Vendor(
        phone_number=phone,
        display_name="Madame Marie",
        pin_hash=hash_pin("135790"),
        preferred_language=PreferredLanguage.HT,
        market_zone="Marché en Fer",
    )
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return vendor


async def _create_transaction(
    db: AsyncSession,
    vendor_id: uuid.UUID,
    txn_type: TransactionType,
    amount: Decimal,
    created_at=None,
) -> Transaction:
    txn = Transaction(
        vendor_id=vendor_id,
        transaction_type=txn_type,
        quantity=Decimal("1"),
        unit_price=amount,
        total_amount=amount,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)

    # Override created_at if provided (for date-based queries)
    if created_at is not None:
        txn.created_at = created_at
        await db.commit()

    return txn


# ---------------------------------------------------------------------------
# generate_daily_report
# ---------------------------------------------------------------------------

class TestGenerateDailyReport:
    async def test_creates_report_record(self, db_session: AsyncSession):
        vendor = await _create_vendor(db_session, phone="+50938010001")
        today = date.today()

        # Create some transactions dated today
        await _create_transaction(db_session, vendor.id, TransactionType.SALE, Decimal("500"))
        await _create_transaction(db_session, vendor.id, TransactionType.SALE, Decimal("300"))
        await _create_transaction(db_session, vendor.id, TransactionType.PURCHASE, Decimal("200"))

        # Import the async helper directly (avoid Celery broker dependency)
        from app.tasks.reports import _generate_report

        # Patch async_session to use our test session
        async def _fake_session():
            return db_session

        class _FakeCtx:
            async def __aenter__(self):
                return db_session

            async def __aexit__(self, *args):
                pass

        with patch("app.tasks.reports.async_session", return_value=_FakeCtx()):
            result = await _generate_report(vendor.id, today)

        assert result["vendor_id"] == str(vendor.id)
        assert Decimal(result["total_revenue"]) == Decimal("800")
        assert Decimal(result["total_cost"]) == Decimal("200")
        assert Decimal(result["net_profit"]) == Decimal("600")

        # Verify report exists in DB
        reports = await db_session.execute(
            select(Report).where(Report.vendor_id == vendor.id)
        )
        report = reports.scalar_one()
        assert report.total_revenue == Decimal("800")
        assert report.net_profit == Decimal("600")

    async def test_no_transactions_produces_zero_report(self, db_session: AsyncSession):
        vendor = await _create_vendor(db_session, phone="+50938010002")

        from app.tasks.reports import _generate_report

        class _FakeCtx:
            async def __aenter__(self):
                return db_session

            async def __aexit__(self, *args):
                pass

        with patch("app.tasks.reports.async_session", return_value=_FakeCtx()):
            result = await _generate_report(vendor.id, date.today())

        assert result["total_revenue"] == "0"
        assert result["total_cost"] == "0"
        assert result["net_profit"] == "0"


# ---------------------------------------------------------------------------
# send_credit_reminders
# ---------------------------------------------------------------------------

class TestSendCreditReminders:
    async def test_marks_entries_as_reminded(self, db_session: AsyncSession):
        vendor = await _create_vendor(db_session, phone="+50938020001")

        # Create an overdue credit entry
        yesterday = date.today() - timedelta(days=1)
        entry = CreditEntry(
            vendor_id=vendor.id,
            customer_name="Jean Pierre",
            customer_phone="+50937009999",
            entry_type=CreditEntryType.CREDIT_GIVEN,
            amount=Decimal("250"),
            balance_after=Decimal("250"),
            due_date=yesterday,
            reminder_sent=False,
        )
        db_session.add(entry)
        await db_session.commit()
        await db_session.refresh(entry)

        from app.tasks.reminders import _get_due_entries

        class _FakeCtx:
            async def __aenter__(self):
                return db_session

            async def __aexit__(self, *args):
                pass

        with patch("app.tasks.reminders.async_session", return_value=_FakeCtx()):
            due = await _get_due_entries()

        assert len(due) == 1
        assert due[0]["customer_name"] == "Jean Pierre"
        assert Decimal(due[0]["amount"]) == Decimal("250")
        assert due[0]["vendor_name"] == "Madame Marie"

        # Verify reminder_sent was set to True
        await db_session.refresh(entry)
        assert entry.reminder_sent is True

    async def test_skips_already_reminded(self, db_session: AsyncSession):
        vendor = await _create_vendor(db_session, phone="+50938020002")

        entry = CreditEntry(
            vendor_id=vendor.id,
            customer_name="Already Reminded",
            customer_phone="+50937008888",
            entry_type=CreditEntryType.CREDIT_GIVEN,
            amount=Decimal("100"),
            balance_after=Decimal("100"),
            due_date=date.today() - timedelta(days=2),
            reminder_sent=True,  # already sent
        )
        db_session.add(entry)
        await db_session.commit()

        from app.tasks.reminders import _get_due_entries

        class _FakeCtx:
            async def __aenter__(self):
                return db_session

            async def __aexit__(self, *args):
                pass

        with patch("app.tasks.reminders.async_session", return_value=_FakeCtx()):
            due = await _get_due_entries()

        assert len(due) == 0

    async def test_skips_future_due_date(self, db_session: AsyncSession):
        vendor = await _create_vendor(db_session, phone="+50938020003")

        entry = CreditEntry(
            vendor_id=vendor.id,
            customer_name="Future Due",
            customer_phone="+50937007777",
            entry_type=CreditEntryType.CREDIT_GIVEN,
            amount=Decimal("100"),
            balance_after=Decimal("100"),
            due_date=date.today() + timedelta(days=5),
            reminder_sent=False,
        )
        db_session.add(entry)
        await db_session.commit()

        from app.tasks.reminders import _get_due_entries

        class _FakeCtx:
            async def __aenter__(self):
                return db_session

            async def __aexit__(self, *args):
                pass

        with patch("app.tasks.reminders.async_session", return_value=_FakeCtx()):
            due = await _get_due_entries()

        assert len(due) == 0
