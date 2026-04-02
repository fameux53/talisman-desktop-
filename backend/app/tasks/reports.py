import asyncio
import logging
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.models.base import async_session
from app.models.report import Report, ReportType
from app.models.transaction import Transaction, TransactionType
from app.models.vendor import Vendor
from app.tasks.celery_app import celery

logger = logging.getLogger(__name__)


async def _generate_report(vendor_id: uuid.UUID, report_date: date) -> dict:
    """Build a daily report for one vendor on a given date."""
    day_start = datetime.combine(report_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)

    async with async_session() as db:
        result = await db.execute(
            select(Transaction).where(
                Transaction.vendor_id == vendor_id,
                Transaction.created_at >= day_start,
                Transaction.created_at < day_end,
            )
        )
        txns = result.scalars().all()

        total_revenue = sum(
            t.total_amount for t in txns if t.transaction_type == TransactionType.SALE
        ) or Decimal("0")
        total_cost = sum(
            t.total_amount for t in txns if t.transaction_type == TransactionType.PURCHASE
        ) or Decimal("0")
        net_profit = total_revenue - total_cost

        report = Report(
            vendor_id=vendor_id,
            report_type=ReportType.DAILY,
            period_start=report_date,
            period_end=report_date,
            total_revenue=total_revenue,
            total_cost=total_cost,
            net_profit=net_profit,
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)

        logger.info(
            "Daily report for vendor %s on %s: revenue=%s cost=%s profit=%s",
            vendor_id, report_date, total_revenue, total_cost, net_profit,
        )

        return {
            "report_id": str(report.id),
            "vendor_id": str(vendor_id),
            "date": str(report_date),
            "total_revenue": str(total_revenue),
            "total_cost": str(total_cost),
            "net_profit": str(net_profit),
        }


@celery.task(name="app.tasks.reports.generate_daily_report")
def generate_daily_report(vendor_id: str, report_date: str | None = None) -> dict:
    vid = uuid.UUID(vendor_id)
    d = date.fromisoformat(report_date) if report_date else date.today()
    return asyncio.run(_generate_report(vid, d))


@celery.task(name="app.tasks.reports.generate_daily_reports")
def generate_daily_reports() -> list[dict]:
    """Beat entry: generate reports for ALL active vendors for yesterday."""

    async def _run():
        async with async_session() as db:
            result = await db.execute(
                select(Vendor.id).where(Vendor.is_active.is_(True))
            )
            vendor_ids = result.scalars().all()

        yesterday = date.today() - timedelta(days=1)
        results = []
        for vid in vendor_ids:
            r = await _generate_report(vid, yesterday)
            results.append(r)
        return results

    return asyncio.run(_run())
