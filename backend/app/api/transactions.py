import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import limiter
from app.api.deps import AuthUser, get_db, require_any_role
from app.models.product import Product
from app.models.transaction import Transaction, TransactionType
from app.schemas.transaction import (
    BulkResultItem,
    BulkTransactionItem,
    BulkTransactionResponse,
    TransactionCreate,
    TransactionOut,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


async def _apply_stock_change(
    db: AsyncSession,
    vendor_id: uuid.UUID,
    product_id: uuid.UUID | None,
    txn_type: TransactionType,
    quantity,
) -> str | None:
    """Adjust product stock for SALE/PURCHASE. Returns a low-stock warning or None."""
    if product_id is None:
        return None

    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.vendor_id == vendor_id)
    )
    product = result.scalar_one_or_none()
    if product is None:
        return None

    if txn_type == TransactionType.SALE:
        product.stock_quantity -= quantity
    elif txn_type == TransactionType.PURCHASE:
        product.stock_quantity += quantity

    if product.stock_quantity < product.low_stock_threshold:
        return (
            f"Low stock warning: {product.name} has {product.stock_quantity} "
            f"{product.unit} remaining (threshold: {product.low_stock_threshold})"
        )
    return None


# ---------------------------------------------------------------------------
# GET /transactions
# ---------------------------------------------------------------------------

@router.get("", response_model=list[TransactionOut])
@limiter.limit("60/minute")
async def list_transactions(
    request: Request,
    type: TransactionType | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(require_any_role),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Transaction).where(Transaction.vendor_id == user.vendor_id)

    if type is not None:
        stmt = stmt.where(Transaction.transaction_type == type)
    if date_from is not None:
        stmt = stmt.where(Transaction.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(Transaction.created_at <= date_to)

    stmt = stmt.order_by(Transaction.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# POST /transactions
# ---------------------------------------------------------------------------

@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
async def create_transaction(
    request: Request,
    body: TransactionCreate,
    user: AuthUser = Depends(require_any_role),
    db: AsyncSession = Depends(get_db),
):
    txn = Transaction(vendor_id=user.vendor_id, **body.model_dump())
    db.add(txn)

    warning = await _apply_stock_change(
        db, user.vendor_id, body.product_id, body.transaction_type, body.quantity,
    )

    await db.commit()
    await db.refresh(txn)

    out = TransactionOut.model_validate(txn)
    out.low_stock_warning = warning
    return out


# ---------------------------------------------------------------------------
# POST /transactions/bulk
# ---------------------------------------------------------------------------

@router.post("/bulk", response_model=BulkTransactionResponse)
@limiter.limit("10/minute")
async def bulk_create_transactions(
    request: Request,
    items: list[BulkTransactionItem],
    user: AuthUser = Depends(require_any_role),
    db: AsyncSession = Depends(get_db),
):
    # Cap bulk size to prevent DoS
    if len(items) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 100 items per bulk request",
        )

    results: list[BulkResultItem] = []

    for idx, item in enumerate(items):
        try:
            txn = Transaction(
                vendor_id=user.vendor_id,
                synced_at=datetime.now(timezone.utc),
                **item.model_dump(exclude={"synced_at"}),
            )
            db.add(txn)

            warning = await _apply_stock_change(
                db, user.vendor_id, item.product_id, item.transaction_type, item.quantity,
            )

            await db.flush()
            await db.refresh(txn)

            out = TransactionOut.model_validate(txn)
            out.low_stock_warning = warning
            results.append(BulkResultItem(index=idx, success=True, transaction=out))
        except Exception as exc:
            await db.rollback()
            import logging
            logging.getLogger("talisman").error("Bulk transaction item %d failed: %s", idx, exc)
            results.append(BulkResultItem(index=idx, success=False, error="Transaction failed"))

    await db.commit()
    return BulkTransactionResponse(results=results)
