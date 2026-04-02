"""
Public API endpoints — no authentication required.
Rate-limited to prevent abuse.
"""

import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import limiter
from app.api.deps import get_db, get_redis
from app.models.credit import CreditEntry, CreditEntryType
from app.models.vendor import Vendor

router = APIRouter(prefix="", tags=["public"])


@router.get("/credit/balance/{vendor_id}/{token}")
@limiter.limit("10/minute")
async def get_customer_balance(
    request: Request,
    vendor_id: str,
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis=Depends(get_redis),
):
    """
    Public endpoint — no auth required.
    Returns limited customer balance data for the shareable link.
    Token is looked up from a server-side mapping (Redis or DB).
    Rate limited: 10 requests per minute per IP.
    """
    # Load vendor
    try:
        vid = uuid.UUID(vendor_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid link")

    result = await db.execute(select(Vendor).where(Vendor.id == vid))
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Invalid link")

    # Look up the customer name by token (stored when the balance link is generated)
    matched_name = await redis.get(f"balance_token:{vendor_id}:{token}")
    if isinstance(matched_name, bytes):
        matched_name = matched_name.decode()
    if not matched_name:
        raise HTTPException(status_code=404, detail="Invalid link")

    # Calculate balance
    balance_result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (CreditEntry.entry_type == CreditEntryType.CREDIT_GIVEN, CreditEntry.amount),
                        else_=-CreditEntry.amount,
                    )
                ),
                Decimal(0),
            )
        )
        .where(CreditEntry.vendor_id == vid, CreditEntry.customer_name == matched_name)
    )
    balance = float(balance_result.scalar_one())

    # Last 5 entries
    entries_result = await db.execute(
        select(CreditEntry)
        .where(CreditEntry.vendor_id == vid, CreditEntry.customer_name == matched_name)
        .order_by(desc(CreditEntry.created_at))
        .limit(5)
    )
    entries = entries_result.scalars().all()

    # Last activity date
    last_activity = entries[0].created_at.isoformat() if entries else None

    return {
        "customer_name": matched_name,
        "vendor_name": vendor.display_name.split()[0],  # First name only
        "balance": balance,
        "currency": "HTG",
        "entries": [
            {
                "type": e.entry_type.value,
                "amount": float(e.amount),
                "date": e.created_at.isoformat(),
            }
            for e in entries
        ],
        "updated_at": last_activity or "",
    }


@router.post("/webhooks/whatsapp")
@limiter.limit("10/minute")
async def whatsapp_webhook(request: Request):
    """
    Future: Receive WhatsApp messages via Twilio/WhatsApp Business API.

    When a customer texts "balans" or "balance" to the vendor's number,
    auto-reply with their credit balance.

    Flow:
    1. Customer sends "Balans mwen" to vendor's WhatsApp Business number
    2. Webhook receives the message
    3. Look up customer by phone number
    4. Reply with balance via WhatsApp API

    TODO: Implement when WhatsApp Business API is connected.
    """
    return {"status": "ok", "message": "WhatsApp webhook not yet implemented"}


@router.get("/moncash/status")
@limiter.limit("10/minute")
async def moncash_status(request: Request):
    """Check if MonCash payment integration is configured."""
    from app.services.moncash import MonCashService
    service = MonCashService()
    return {
        "configured": service.is_configured,
        "sandbox": service.base_url.startswith("https://sandbox"),
    }
