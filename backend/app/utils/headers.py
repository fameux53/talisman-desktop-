"""Security headers middleware."""

from fastapi import Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request

from app.config import settings

# Content-Security-Policy notes:
# - 'unsafe-inline' for style-src is REQUIRED because React uses style={{}} for
#   dynamic CSS values (animation delays, calculated widths, progress bars).
#   Tailwind utility classes cannot replace these. This is standard for React apps.
# - connect-src includes CORS_ORIGINS so split-origin deployments work.

_connect_sources = "'self' " + " ".join(settings.cors_origins_list)

_CSP = (
    "default-src 'none'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "img-src 'self' data: blob:; "
    "font-src 'self' https://fonts.gstatic.com; "
    f"connect-src {_connect_sources}; "
    "manifest-src 'self'; "
    "worker-src 'self'; "
    "object-src 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint,
    ) -> Response:
        response = await call_next(request)

        # Don't overwrite CORS headers — CORSMiddleware (outermost) handles them.
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
        response.headers["Content-Security-Policy"] = _CSP
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(self), geolocation=()"
        )
        return response
