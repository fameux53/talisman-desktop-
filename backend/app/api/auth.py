import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthUser, get_current_user, get_current_vendor, get_db, get_redis
from app.config import settings
from app.models.vendor import Vendor
from app.schemas.auth import (
    CheckPhoneRequest,
    ForgotPinRequest,
    LoginRequest,
    RegisterRequest,
    ResetPinRequest,
    SecurityQuestionReset,
    VendorOut,
    VerifyResetCode,
)
from app.utils.security import (
    blacklist_token,
    create_access_token,
    create_refresh_token,
    hash_pin,
    is_token_blacklisted,
    verify_pin,
    verify_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

_MAX_FAILED = 5
_LOCKOUT_MINUTES = 30
_PROGRESSIVE_DELAYS = [0, 1, 2, 4, 4]  # seconds per attempt (0-indexed)


def _set_auth_cookies(response: JSONResponse, access_token: str, refresh_token: str) -> None:
    secure = settings.COOKIE_SECURE
    response.set_cookie(
        key="tlsm_access_token", value=access_token,
        httponly=True, secure=secure, samesite="strict", max_age=3600, path="/",
    )
    response.set_cookie(
        key="tlsm_refresh_token", value=refresh_token,
        httponly=True, secure=secure, samesite="strict", max_age=604800, path="/",
    )


def _clear_auth_cookies(response: JSONResponse) -> None:
    response.delete_cookie("tlsm_access_token", path="/")
    response.delete_cookie("tlsm_refresh_token", path="/")


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    vendor = Vendor(
        phone_number=body.phone_number,
        display_name=body.display_name,
        pin_hash=hash_pin(body.pin),
        preferred_language=body.preferred_language,
    )
    db.add(vendor)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone number already registered")
    await db.refresh(vendor)
    vendor_data = VendorOut.model_validate(vendor).model_dump(mode="json")

    access_token = create_access_token(vendor.id)
    refresh_token = create_refresh_token(vendor.id)
    response = JSONResponse(content={"vendor": vendor_data}, status_code=201)
    _set_auth_cookies(response, access_token, refresh_token)
    return response


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Vendor).where(Vendor.phone_number == body.phone_number))
    vendor = result.scalar_one_or_none()

    if vendor is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid phone number or PIN")

    # Check lockout FIRST — reject without checking PIN
    now = datetime.now(timezone.utc)
    if vendor.locked_until is not None:
        locked = vendor.locked_until
        if locked.tzinfo is None:
            locked = locked.replace(tzinfo=timezone.utc)
        if locked > now:
            remaining = int((locked - now).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account locked. Try again in {remaining // 60 + 1} minutes.",
            )

    # Employee login — PIN is verified client-side against IndexedDB hash.
    # Backend issues a scoped JWT for API access tracking.
    # Security: role is clamped to assistant/manager — never allow 'owner' escalation.
    if body.employee_id:
        vendor_data = VendorOut.model_validate(vendor).model_dump(mode="json")
        role = body.role if body.role in ("assistant", "manager") else "assistant"
        access_token = create_access_token(vendor.id, employee_id=body.employee_id, role=role)
        refresh_token = create_refresh_token(vendor.id, employee_id=body.employee_id, role=role)
        response = JSONResponse(content={"vendor": vendor_data, "role": role, "employee_id": body.employee_id})
        _set_auth_cookies(response, access_token, refresh_token)
        return response

    # Verify PIN (owner login)
    if not verify_pin(vendor.pin_hash, body.pin):
        vendor.failed_login_attempts += 1

        # Progressive delay based on attempt count
        delay_idx = min(vendor.failed_login_attempts - 1, len(_PROGRESSIVE_DELAYS) - 1)
        delay = _PROGRESSIVE_DELAYS[delay_idx]
        if delay > 0:
            await asyncio.sleep(delay)

        if vendor.failed_login_attempts >= _MAX_FAILED:
            vendor.locked_until = now + timedelta(minutes=_LOCKOUT_MINUTES)

        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid phone number or PIN")

    # Success — reset counters
    vendor.failed_login_attempts = 0
    vendor.locked_until = None
    await db.commit()

    vendor_data = VendorOut.model_validate(vendor).model_dump(mode="json")

    # Determine role and employee_id from request body (employee login support)
    employee_id = getattr(body, 'employee_id', None)
    role = getattr(body, 'role', 'owner') or 'owner'

    access_token = create_access_token(vendor.id, employee_id=employee_id, role=role)
    refresh_token = create_refresh_token(vendor.id, employee_id=employee_id, role=role)
    response = JSONResponse(content={"vendor": vendor_data, "role": role, "employee_id": employee_id})
    _set_auth_cookies(response, access_token, refresh_token)
    return response


# ---------------------------------------------------------------------------
# POST /auth/check-phone  (lightweight — no auth required)
# ---------------------------------------------------------------------------


@router.post("/check-phone")
@limiter.limit("5/minute")
async def check_phone(
    request: Request,
    body: CheckPhoneRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Vendor).where(Vendor.phone_number == body.phone_number))
    vendor = result.scalar_one_or_none()
    if not vendor:
        return {"exists": False, "display_name": None, "vendor_id": None}
    return {
        "exists": True,
        "vendor_id": str(vendor.id),
        "display_name": vendor.display_name,
    }


# ---------------------------------------------------------------------------
# POST /auth/refresh
# ---------------------------------------------------------------------------

@router.post("/refresh")
@limiter.limit("20/minute")
async def refresh(
    request: Request,
    tlsm_refresh_token: str = Cookie(None),
    redis=Depends(get_redis),
):
    from app.utils.security import JWTError
    import uuid

    token = tlsm_refresh_token
    if not token:
        try:
            body = await request.json()
            token = body.get("refresh_token")
        except Exception:
            pass
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    try:
        payload = verify_token(token, expected_type="refresh")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    # Reject blacklisted refresh tokens (logged-out sessions)
    if await is_token_blacklisted(redis, token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    vendor_id = uuid.UUID(payload["sub"])
    # Preserve role and employee_id from the refresh token
    role = payload.get("role", "owner")
    employee_id = payload.get("employee_id")
    new_access = create_access_token(vendor_id, employee_id=employee_id, role=role)
    response = JSONResponse(content={"message": "Token refreshed"})
    response.set_cookie(
        key="tlsm_access_token", value=new_access,
        httponly=True, secure=settings.COOKIE_SECURE, samesite="strict", max_age=3600, path="/",
    )
    return response


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def logout(
    request: Request,
    user: AuthUser = Depends(get_current_user),
    redis=Depends(get_redis),
):
    # Blacklist the access token
    access_token = request.cookies.get("tlsm_access_token") or ""
    if not access_token:
        auth_header = request.headers.get("authorization", "")
        access_token = auth_header.removeprefix("Bearer ").strip()
    await blacklist_token(redis, access_token)

    # Also blacklist the refresh token so it can't mint new access tokens
    refresh_token = request.cookies.get("tlsm_refresh_token") or ""
    if refresh_token:
        await blacklist_token(redis, refresh_token)

    response = JSONResponse(content=None, status_code=204)
    _clear_auth_cookies(response)
    return response


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get("/me")
@limiter.limit("30/minute")
async def get_me(request: Request, user: AuthUser = Depends(get_current_user)):
    vendor_data = VendorOut.model_validate(user.vendor).model_dump(mode="json")
    return {"vendor": vendor_data, "role": user.role, "employee_id": user.employee_id}


# ---------------------------------------------------------------------------
# PIN Recovery — Method 1: SMS Code
# ---------------------------------------------------------------------------

@router.post("/forgot-pin/request")
@limiter.limit("3/hour")
async def request_pin_reset(
    request: Request,
    body: ForgotPinRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    import json
    import random
    from app.services.sms import sms_service

    # Always return success to prevent phone enumeration
    result = await db.execute(select(Vendor).where(Vendor.phone_number == body.phone_number))
    vendor = result.scalar_one_or_none()

    if vendor:
        code = str(random.randint(100000, 999999))
        await redis.setex(
            f"pin_reset:{body.phone_number}",
            600,  # 10 minutes
            json.dumps({"code": code, "attempts": 0}),
        )
        await sms_service.send(
            to=body.phone_number,
            message=f"Talisman: Kòd rekiperasyon ou se {code}. Li valab pou 10 minit. Pa pataje l ak pèsonn.",
        )

    return {"message": "If this phone is registered, a code has been sent.", "expires_in": 600}


@router.post("/forgot-pin/verify")
@limiter.limit("10/hour")
async def verify_reset_code(
    request: Request,
    body: VerifyResetCode,
    redis=Depends(get_redis),
):
    import json
    import secrets

    stored = await redis.get(f"pin_reset:{body.phone_number}")
    if not stored:
        raise HTTPException(status_code=400, detail="No pending reset or code expired")

    stored_data = json.loads(stored)

    if stored_data["attempts"] >= 5:
        await redis.delete(f"pin_reset:{body.phone_number}")
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")

    if body.code != stored_data["code"]:
        stored_data["attempts"] += 1
        await redis.setex(
            f"pin_reset:{body.phone_number}",
            600,
            json.dumps(stored_data),
        )
        raise HTTPException(status_code=400, detail="Invalid code")

    # Code valid — issue reset token
    reset_token = secrets.token_urlsafe(32)
    await redis.setex(f"pin_reset_token:{reset_token}", 300, body.phone_number)  # 5 min
    await redis.delete(f"pin_reset:{body.phone_number}")

    return {"reset_token": reset_token}


@router.post("/forgot-pin/reset")
@limiter.limit("5/hour")
async def reset_pin(
    request: Request,
    body: ResetPinRequest,
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    phone = await redis.get(f"pin_reset_token:{body.reset_token}")
    if not phone:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    # Handle both bytes and str (real Redis returns bytes, FakeRedis returns str)
    if isinstance(phone, bytes):
        phone = phone.decode()

    result = await db.execute(select(Vendor).where(Vendor.phone_number == phone))
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=400, detail="Vendor not found")

    vendor.pin_hash = hash_pin(body.new_pin)
    vendor.failed_login_attempts = 0
    vendor.locked_until = None
    await db.commit()

    await redis.delete(f"pin_reset_token:{body.reset_token}")
    return {"message": "PIN updated successfully"}


# ---------------------------------------------------------------------------
# PIN Recovery — Method 2: Security Question (offline fallback)
# ---------------------------------------------------------------------------

@router.post("/forgot-pin/security-question")
@limiter.limit("5/hour")
async def reset_pin_security_question(
    request: Request,
    body: SecurityQuestionReset,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Vendor).where(Vendor.phone_number == body.phone_number))
    vendor = result.scalar_one_or_none()

    if not vendor or not vendor.security_answer_hash:
        raise HTTPException(status_code=400, detail="Security question not set or invalid phone")

    # Verify answer (case-insensitive comparison via hash)
    if not verify_pin(vendor.security_answer_hash, body.security_answer.strip().lower()):
        raise HTTPException(status_code=400, detail="Incorrect answer")

    vendor.pin_hash = hash_pin(body.new_pin)
    vendor.failed_login_attempts = 0
    vendor.locked_until = None
    await db.commit()

    return {"message": "PIN updated successfully"}
