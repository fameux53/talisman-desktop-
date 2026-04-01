import asyncio
import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.models.base import async_session
from app.models.credit import CreditEntry, CreditEntryType
from app.models.vendor import Vendor
from app.tasks.celery_app import celery
from app.tasks.sms import send_sms

logger = logging.getLogger(__name__)


async def _get_due_entries() -> list[dict]:
    """Find credit entries that are overdue, not yet reminded, with positive balance."""
    today = date.today()

    async with async_session() as db:
        result = await db.execute(
            select(CreditEntry).where(
                CreditEntry.entry_type == CreditEntryType.CREDIT_GIVEN,
                CreditEntry.due_date <= today,
                CreditEntry.reminder_sent.is_(False),
                CreditEntry.balance_after > Decimal("0"),
            )
        )
        entries = result.scalars().all()

        due_entries = []
        for entry in entries:
            # Load vendor name
            vendor_result = await db.execute(
                select(Vendor).where(Vendor.id == entry.vendor_id)
            )
            vendor = vendor_result.scalar_one()

            due_entries.append({
                "entry_id": str(entry.id),
                "customer_phone": entry.customer_phone,
                "customer_name": entry.customer_name,
                "amount": str(entry.amount),
                "vendor_name": vendor.display_name,
            })

            entry.reminder_sent = True

        await db.commit()
        return due_entries


@celery.task(name="app.tasks.reminders.send_credit_reminders")
def send_credit_reminders() -> list[dict]:
    entries = asyncio.run(_get_due_entries())
    results = []

    for entry in entries:
        phone = entry["customer_phone"]
        if not phone:
            logger.warning(
                "No phone for customer %s, skipping reminder for entry %s",
                entry["customer_name"], entry["entry_id"],
            )
            results.append({**entry, "status": "skipped", "reason": "no_phone"})
            continue

        message = (
            f"Bonjou! Ou gen yon dèt {entry['amount']} goud "
            f"kay {entry['vendor_name']}. Tanpri pase regle. Mèsi!"
        )
        send_sms.delay(phone, message)

        logger.info("Reminder queued for %s (entry %s)", phone, entry["entry_id"])
        results.append({**entry, "status": "queued"})

    return results
