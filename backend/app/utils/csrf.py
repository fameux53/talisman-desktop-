"""Double-submit cookie CSRF protection for state-changing requests."""

import secrets

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.config import settings

CSRF_COOKIE = "tlsm_csrf_token"
CSRF_HEADER = "x-csrf-token"
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# Endpoints exempt from CSRF (no cookie auth yet at these points)
_EXEMPT_PATHS = {"/auth/login", "/auth/register", "/auth/refresh", "/auth/forgot-pin", "/auth/check-phone", "/health"}
_TESTING = False  # Set to True in test conftest to skip CSRF validation


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Validate on state-changing requests
        if request.method not in _SAFE_METHODS and not _TESTING:
            path = request.url.path
            if not any(path.startswith(p) for p in _EXEMPT_PATHS):
                cookie_token = request.cookies.get(CSRF_COOKIE)
                header_token = request.headers.get(CSRF_HEADER)

                if not cookie_token or not header_token or cookie_token != header_token:
                    return JSONResponse(status_code=403, content={"detail": "CSRF token missing or mismatch"})

        response = await call_next(request)

        # Set/refresh CSRF cookie on every response
        if not request.cookies.get(CSRF_COOKIE):
            samesite = "none" if settings.COOKIE_SECURE else "lax"
            response.set_cookie(
                key=CSRF_COOKIE,
                value=secrets.token_urlsafe(32),
                httponly=False,  # JS must read this
                secure=settings.COOKIE_SECURE,
                samesite=samesite,
                max_age=86400,
                path="/",
            )

        return response
