"""Security headers middleware."""

from fastapi import Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request

# Content-Security-Policy notes:
# - 'unsafe-inline' for style-src is REQUIRED because React uses style={{}} for
#   dynamic CSS values (animation delays, calculated widths, progress bars).
#   Tailwind utility classes cannot replace these. This is standard for React apps.
# - connect-src 'self' allows API calls to the same origin in production.
#   In development, the frontend dev server proxies to localhost:8000.

_CSP = (
    "default-src 'none'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "img-src 'self' data: blob:; "
    "font-src 'self' https://fonts.gstatic.com; "
    "connect-src 'self'; "
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

        # Preserve CORS headers — re-inject if origin matches
        from app.config import settings
        origin = request.headers.get("origin", "")
        if origin and any(origin == o for o in settings.CORS_ORIGINS):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
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
