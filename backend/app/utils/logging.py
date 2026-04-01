"""Structured JSON logging with correlation IDs and PII masking."""

import json
import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

_REQUEST_ID_HEADER = "X-Request-ID"


def mask_phone(value: str) -> str:
    """Mask phone numbers, keeping only last 4 digits."""
    return re.sub(r"\+?\d{4,}(\d{4})", r"****\1", value)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Attach extras if present
        for attr in ("request_id", "vendor_id", "event", "ip", "path", "method"):
            val = getattr(record, attr, None)
            if val is not None:
                log_entry[attr] = val
        return json.dumps(log_entry)


def setup_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Attach X-Request-ID to every request and log request/response."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint,
    ) -> Response:
        request_id = request.headers.get(_REQUEST_ID_HEADER, str(uuid.uuid4()))
        # Store on request state for downstream use
        request.state.request_id = request_id

        logger = logging.getLogger("talisman.access")
        logger.info(
            "request started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "ip": request.client.host if request.client else "unknown",
                "event": "request_start",
            },
        )

        response = await call_next(request)
        response.headers[_REQUEST_ID_HEADER] = request_id

        logger.info(
            "request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "event": "request_end",
                "status": response.status_code,
            },
        )
        return response
