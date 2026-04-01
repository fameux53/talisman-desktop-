import uuid
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from redis.asyncio import Redis

from app.config import settings

_ph = PasswordHasher()

# ---------------------------------------------------------------------------
# PIN hashing
# ---------------------------------------------------------------------------

def hash_pin(pin: str) -> str:
    return _ph.hash(pin)


def verify_pin(pin_hash: str, pin: str) -> bool:
    try:
        return _ph.verify(pin_hash, pin)
    except VerifyMismatchError:
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

_ALGORITHM = "HS256"
_BLACKLIST_PREFIX = "bl:"


class JWTError(Exception):
    """Raised on any JWT validation failure (compatible with old jose.JWTError)."""


def create_access_token(
    vendor_id: uuid.UUID,
    employee_id: str | None = None,
    role: str = "owner",
) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=60)
    payload: dict = {"sub": str(vendor_id), "exp": exp, "type": "access", "role": role}
    if employee_id:
        payload["employee_id"] = employee_id
    return pyjwt.encode(payload, settings.SECRET_KEY, algorithm=_ALGORITHM)


def create_refresh_token(
    vendor_id: uuid.UUID,
    employee_id: str | None = None,
    role: str = "owner",
) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=7)
    payload: dict = {"sub": str(vendor_id), "exp": exp, "type": "refresh", "role": role}
    if employee_id:
        payload["employee_id"] = employee_id
    return pyjwt.encode(payload, settings.SECRET_KEY, algorithm=_ALGORITHM)


def verify_token(token: str, expected_type: str = "access") -> dict:
    """Decode and validate a JWT. Returns the payload dict.

    Raises ``JWTError`` on any validation failure.
    """
    try:
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=[_ALGORITHM])
    except pyjwt.PyJWTError as exc:
        raise JWTError(str(exc)) from exc
    if payload.get("type") != expected_type:
        raise JWTError("unexpected token type")
    return payload


# ---------------------------------------------------------------------------
# Token blacklist (Redis)
# ---------------------------------------------------------------------------

async def blacklist_token(redis: Redis, token: str) -> None:
    """Add *token* to the blacklist for its remaining lifetime."""
    try:
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=[_ALGORITHM])
    except pyjwt.PyJWTError:
        return
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    ttl = int((exp - datetime.now(timezone.utc)).total_seconds())
    if ttl > 0:
        await redis.setex(f"{_BLACKLIST_PREFIX}{token}", ttl, "1")


async def is_token_blacklisted(redis: Redis, token: str) -> bool:
    return await redis.exists(f"{_BLACKLIST_PREFIX}{token}") > 0
