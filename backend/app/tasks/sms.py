import hashlib
import logging
import time

import httpx

from app.config import settings
from app.tasks.celery_app import celery

logger = logging.getLogger(__name__)


def _phone_ref(phone: str) -> str:
    """Return a short opaque hash of a phone number for log correlation."""
    return hashlib.sha256(phone.encode()).hexdigest()[:8]


def _send_stub(phone_number: str, message: str) -> dict:
    """Log the SMS and store in Redis for testing."""
    from redis import Redis as SyncRedis

    logger.info("SMS STUB ref=%s length=%d", _phone_ref(phone_number), len(message))
    r = SyncRedis.from_url(settings.REDIS_URL, decode_responses=True)
    key = f"sms:{phone_number}:{int(time.time())}"
    r.setex(key, 86400, message)  # 24h TTL
    r.close()
    return {"status": "stub", "key": key}


def _send_digicel(phone_number: str, message: str) -> dict:
    """Send via Digicel SMS gateway."""
    resp = httpx.post(
        settings.SMS_GATEWAY_URL,
        json={"to": phone_number, "body": message},
        headers={"Authorization": f"Bearer {settings.SMS_API_KEY}"},
        timeout=10,
    )
    resp.raise_for_status()
    return {"status": "sent", "provider": "digicel", "response": resp.json()}


def _send_natcom(phone_number: str, message: str) -> dict:
    """Send via Natcom SMS gateway."""
    resp = httpx.post(
        settings.SMS_GATEWAY_URL,
        json={"phone": phone_number, "text": message},
        headers={"X-API-Key": settings.SMS_API_KEY},
        timeout=10,
    )
    resp.raise_for_status()
    return {"status": "sent", "provider": "natcom", "response": resp.json()}


_PROVIDERS = {
    "stub": _send_stub,
    "digicel": _send_digicel,
    "natcom": _send_natcom,
}


@celery.task(name="app.tasks.sms.send_sms", bind=True, max_retries=3)
def send_sms(self, phone_number: str, message: str) -> dict:
    provider = settings.SMS_PROVIDER
    send_fn = _PROVIDERS.get(provider)
    if send_fn is None:
        raise ValueError(f"Unknown SMS provider: {provider}")

    try:
        return send_fn(phone_number, message)
    except Exception as exc:
        logger.exception("SMS send failed ref=%s via %s", _phone_ref(phone_number), provider)
        raise self.retry(exc=exc, countdown=60)
