import time
import uuid
from dataclasses import dataclass
from typing import Annotated, Callable, Optional

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.utils.security import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import async_session
from app.models.vendor import Vendor
from app.utils.security import is_token_blacklisted, verify_token

_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Authenticated user context (vendor + optional employee role)
# ---------------------------------------------------------------------------

@dataclass
class AuthUser:
    """Authenticated user context extracted from JWT."""
    vendor: Vendor
    vendor_id: uuid.UUID
    role: str = "owner"  # 'owner' | 'manager' | 'assistant'
    employee_id: str | None = None


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with async_session() as session:
        yield session


class _FakeRedis:
    """In-memory Redis stand-in when Redis is unavailable."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}
        self._expiry: dict[str, float] = {}

    async def setex(self, key: str, ttl: int, value: str) -> None:
        self._store[key] = value
        self._expiry[key] = time.monotonic() + ttl

    async def get(self, key: str) -> str | None:
        if key in self._expiry and time.monotonic() > self._expiry[key]:
            self._store.pop(key, None)
            self._expiry.pop(key, None)
            return None
        return self._store.get(key)

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)
        self._expiry.pop(key, None)

    async def exists(self, key: str) -> int:
        if key in self._expiry and time.monotonic() > self._expiry[key]:
            self._store.pop(key, None)
            self._expiry.pop(key, None)
            return 0
        return 1 if key in self._store else 0

    async def aclose(self) -> None:
        pass


_fake_redis = _FakeRedis()


async def get_redis():  # type: ignore[misc]
    from app.config import settings

    if settings.REDIS_URL.startswith("fake://"):
        yield _fake_redis
        return

    from redis.asyncio import Redis

    r = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield r
    finally:
        await r.aclose()


async def get_current_user(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[object, Depends(get_redis)],
    tlsm_access_token: Optional[str] = Cookie(None),
) -> AuthUser:
    """Extract token from httpOnly cookie first, then fall back to Bearer header.
    Returns an AuthUser with vendor, role, and optional employee_id."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Resolve token: Bearer header takes priority (explicit auth), then cookie
    token = None
    if credentials:
        token = credentials.credentials
    if not token:
        token = tlsm_access_token
    if not token:
        raise credentials_exc

    # Decode
    try:
        payload = verify_token(token, expected_type="access")
    except JWTError:
        raise credentials_exc

    # Blacklist check
    if await is_token_blacklisted(redis, token):
        raise credentials_exc

    # Load vendor
    vendor_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = result.scalar_one_or_none()
    if vendor is None or not vendor.is_active:
        raise credentials_exc

    return AuthUser(
        vendor=vendor,
        vendor_id=vendor_id,
        role=payload.get("role", "owner"),
        employee_id=payload.get("employee_id"),
    )


# Backwards-compatible alias: endpoints that only need the Vendor object
async def get_current_vendor(
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> Vendor:
    return user.vendor


# ---------------------------------------------------------------------------
# Role-based permission dependencies
# ---------------------------------------------------------------------------

def require_role(*allowed_roles: str) -> Callable:
    """FastAPI dependency that checks if the current user has one of the allowed roles."""
    async def _check(user: Annotated[AuthUser, Depends(get_current_user)]) -> AuthUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this resource",
            )
        return user
    return _check


# Convenience shortcuts
require_owner = require_role("owner")
require_manager_or_owner = require_role("owner", "manager")
require_any_role = require_role("owner", "manager", "assistant")
