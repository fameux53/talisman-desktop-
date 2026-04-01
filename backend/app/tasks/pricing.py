import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from redis import Redis as SyncRedis
from sqlalchemy import select

from app.config import settings
from app.models.base import async_session
from app.models.product import Product
from app.models.transaction import Transaction, TransactionType
from app.models.vendor import Vendor
from app.tasks.celery_app import celery

logger = logging.getLogger(__name__)

_WEEKS = 4
_TTL_DAYS = 7


class _DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return str(o)
        return super().default(o)


async def _aggregate() -> dict:
    four_weeks_ago = datetime.now(timezone.utc) - timedelta(weeks=_WEEKS)

    async with async_session() as db:
        # Fetch SALE transactions from the past 4 weeks with product + vendor info
        result = await db.execute(
            select(Transaction, Product.name, Vendor.market_zone)
            .join(Product, Transaction.product_id == Product.id)
            .join(Vendor, Transaction.vendor_id == Vendor.id)
            .where(
                Transaction.transaction_type == TransactionType.SALE,
                Transaction.created_at >= four_weeks_ago,
            )
        )
        rows = result.all()

    # Group by (market_zone, product_name) → list of unit_prices
    aggregated: dict[tuple[str, str], list[Decimal]] = {}
    for txn, product_name, market_zone in rows:
        zone = market_zone or "unknown"
        key = (zone, product_name)
        aggregated.setdefault(key, []).append(txn.unit_price)

    # Calculate averages and store in Redis
    r = SyncRedis.from_url(settings.REDIS_URL, decode_responses=True)
    stored = {}

    for (zone, product_name), prices in aggregated.items():
        avg_price = sum(prices) / len(prices)
        redis_key = f"pricing:{zone}:{product_name}"
        payload = {
            "product_name": product_name,
            "market_zone": zone,
            "average_price": str(avg_price.quantize(Decimal("0.01"))),
            "sample_count": len(prices),
            "weeks_covered": _WEEKS,
        }
        r.setex(redis_key, _TTL_DAYS * 86400, json.dumps(payload, cls=_DecimalEncoder))
        stored[redis_key] = payload
        logger.info("Pricing: %s = %s (%d samples)", redis_key, payload["average_price"], len(prices))

    r.close()
    return stored


@celery.task(name="app.tasks.pricing.aggregate_pricing_data")
def aggregate_pricing_data() -> dict:
    return asyncio.run(_aggregate())
