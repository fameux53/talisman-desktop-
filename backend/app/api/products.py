import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import limiter
from app.api.deps import AuthUser, get_db, require_any_role, require_manager_or_owner
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
@limiter.limit("60/minute")
async def list_products(
    request: Request,
    search: str | None = Query(None),
    user: AuthUser = Depends(require_any_role),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Product).where(
        Product.vendor_id == user.vendor_id,
        Product.is_active.is_(True),
    )
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(pattern),
                Product.name_creole.ilike(pattern),
            )
        )
    stmt = stmt.order_by(Product.name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_product(
    request: Request,
    body: ProductCreate,
    user: AuthUser = Depends(require_manager_or_owner),
    db: AsyncSession = Depends(get_db),
):
    product = Product(vendor_id=user.vendor_id, **body.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut)
@limiter.limit("30/minute")
async def update_product(
    request: Request,
    product_id: uuid.UUID,
    body: ProductUpdate,
    user: AuthUser = Depends(require_manager_or_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.vendor_id == user.vendor_id)
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def delete_product(
    request: Request,
    product_id: uuid.UUID,
    user: AuthUser = Depends(require_manager_or_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.vendor_id == user.vendor_id)
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product.is_active = False
    await db.commit()
