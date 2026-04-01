import secrets
import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import limiter
from app.api.deps import AuthUser, get_db, get_redis, require_manager_or_owner
from app.models.credit import CreditEntry, CreditEntryType
from app.schemas.credit import (
    CreditCreate,
    CreditOut,
    CreditSummary,
    CreditUpdate,
    CustomerBalance,
)

router = APIRouter(prefix="/credit", tags=["credit"])


async def _get_customer_balance(
    db: AsyncSession, vendor_id: uuid.UUID, customer_name: str,
) -> Decimal:
    """Return the current balance for a customer (sum of credits minus payments)."""
    result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (CreditEntry.entry_type == CreditEntryType.CREDIT_GIVEN, CreditEntry.amount),
                        else_=-CreditEntry.amount,
                    )
                ),
                Decimal("0"),
            )
        ).where(
            CreditEntry.vendor_id == vendor_id,
            CreditEntry.customer_name == customer_name,
        )
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# GET /credit
# ---------------------------------------------------------------------------

@router.get("", response_model=list[CustomerBalance])
@limiter.limit("30/minute")
async def list_credit(
    request: Request,
    user: AuthUser = Depends(require_manager_or_owner),
    db: AsyncSession = Depends(get_db),
):
    # Fetch ALL entries for this vendor in one query, ordered for grouping
    entries_result = await db.execute(
        select(CreditEntry)
        .where(CreditEntry.vendor_id == user.vendor_id)
        .order_by(CreditEntry.customer_name, CreditEntry.created_at.desc())
    )
    all_entries = entries_result.scalars().all()

    # Compute per-customer balances in a single aggregate query
    balances_result = await db.execute(
        select(
            CreditEntry.customer_name,
            func.coalesce(
                func.sum(
                    case(
                        (CreditEntry.entry_type == CreditEntryType.CREDIT_GIVEN, CreditEntry.amount),
                        else_=-CreditEntry.amount,
                    )
                ),
                Decimal("0"),
            ).label("balance"),
        )
        .where(CreditEntry.vendor_id == user.vendor_id)
        .group_by(CreditEntry.customer_name)
    )
    balance_map: dict[str, Decimal] = {row[0]: row[1] for row in balances_result.all()}

    # Group entries by customer name
    from itertools import groupby
    groups: list[CustomerBalance] = []
    for name, entries_iter in groupby(all_entries, key=lambda e: e.customer_name):
        entries = list(entries_iter)
        phone = next((e.customer_phone for e in entries if e.customer_phone), None)
        groups.append(
            CustomerBalance(
                customer_name=name,
                customer_phone=phone,
                balance=balance_map.get(name, Decimal("0")),
                entries=[CreditOut.model_validate(e) for e in entries],
            )
        )

    # Sort by customer name
    groups.sort(key=lambda g: g.customer_name)
    return groups


# ---------------------------------------------------------------------------
# GET /credit/summary
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=CreditSummary)
@limiter.limit("30/minute")
async def credit_summary(
    request: Request,
    user: AuthUser = Depends(require_manager_or_owner),
    db: AsyncSession = Depends(get_db),
):
    # Total outstanding = sum(CREDIT_GIVEN) - sum(PAYMENT_RECEIVED)
    outstanding_result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (CreditEntry.entry_type == CreditEntryType.CREDIT_GIVEN, CreditEntry.amount),
                        else_=-CreditEntry.amount,
                    )
                ),
                Decimal("0"),
            )
        ).where(CreditEntry.vendor_id == user.vendor_id)
    )
    total_outstanding = outstanding_result.scalar_one()

    # Unique customers
    customers_result = await db.execute(
        select(func.count(func.distinct(CreditEntry.customer_name))).where(
            CreditEntry.vendor_id == user.vendor_id
        )
    )
    unique_customers = customers_result.scalar_one()

    # Overdue: CREDIT_GIVEN entries with due_date < today that haven't been fully paid
    # Simplified: count entries where due_date is past and entry_type is CREDIT_GIVEN
    today = date.today()
    overdue_result = await db.execute(
        select(func.count()).where(
            CreditEntry.vendor_id == user.vendor_id,
            CreditEntry.entry_type == CreditEntryType.CREDIT_GIVEN,
            CreditEntry.due_date < today,
        )
    )
    overdue_entries = overdue_result.scalar_one()

    return CreditSummary(
        total_outstanding=total_outstanding,
        unique_customers=unique_customers,
        overdue_entries=overdue_entries,
    )


# ---------------------------------------------------------------------------
# POST /credit
# ---------------------------------------------------------------------------

@router.post("", response_model=CreditOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_credit(
    request: Request,
    body: CreditCreate,
    user: AuthUser = Depends(require_manager_or_owner),
    db: AsyncSession = Depends(get_db),
):
    current_balance = await _get_customer_balance(db, user.vendor_id, body.customer_name)

    if body.entry_type == CreditEntryType.CREDIT_GIVEN:
        balance_after = current_balance + body.amount
    else:
        balance_after = current_balance - body.amount

    entry = CreditEntry(
        vendor_id=user.vendor_id,
        balance_after=balance_after,
        **body.model_dump(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


# ---------------------------------------------------------------------------
# PATCH /credit/{id}
# ---------------------------------------------------------------------------

@router.patch("/{entry_id}", response_model=CreditOut)
@limiter.limit("30/minute")
async def update_credit(
    request: Request,
    entry_id: uuid.UUID,
    body: CreditUpdate,
    user: AuthUser = Depends(require_manager_or_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditEntry).where(
            CreditEntry.id == entry_id, CreditEntry.vendor_id == user.vendor_id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit entry not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)

    await db.commit()
    await db.refresh(entry)
    return entry


# ---------------------------------------------------------------------------
# POST /credit/balance-token — generate a secure balance sharing token
# ---------------------------------------------------------------------------

class BalanceTokenRequest(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=200)


class BalanceTokenResponse(BaseModel):
    token: str


@router.post("/balance-token", response_model=BalanceTokenResponse)
@limiter.limit("30/minute")
async def create_balance_token(
    request: Request,
    body: BalanceTokenRequest,
    user: AuthUser = Depends(require_manager_or_owner),
    redis=Depends(get_redis),
):
    """Generate a cryptographic balance token for a customer and store the mapping."""
    token = secrets.token_urlsafe(12)  # 16-char URL-safe string
    vendor_id = str(user.vendor_id)
    # Store mapping: token -> customer_name (expires in 90 days)
    await redis.setex(
        f"balance_token:{vendor_id}:{token}",
        90 * 24 * 3600,
        body.customer_name,
    )
    return BalanceTokenResponse(token=token)
