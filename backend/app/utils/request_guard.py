"""Mitigations for Starlette CVEs that don't yet have upstream fixes.

CVE-2024-47874: O(n²) DoS via Range header merging in FileResponse
  — Reject requests with more than 10 Range parts.

CVE-2024-47824: DoS when parsing large files in multipart forms
  — Limit Content-Length to 10 MB for multipart uploads.
"""

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

_MAX_RANGE_PARTS = 10
_MAX_MULTIPART_BYTES = 10 * 1024 * 1024  # 10 MB


class RequestGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Guard 1: Reject excessive Range header parts (O(n²) merging DoS)
        range_header = request.headers.get("range")
        if range_header:
            parts = range_header.split(",")
            if len(parts) > _MAX_RANGE_PARTS:
                return JSONResponse(
                    status_code=416,
                    content={"detail": "Too many range parts"},
                )

        # Guard 2: Reject oversized multipart uploads
        content_type = request.headers.get("content-type", "")
        if "multipart/form-data" in content_type:
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > _MAX_MULTIPART_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Request body too large"},
                )

        return await call_next(request)
