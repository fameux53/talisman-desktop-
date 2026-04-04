import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.auth import limiter, router as auth_router
from app.api.credit import router as credit_router
from app.api.nlp import router as nlp_router
from app.api.products import router as products_router
from app.api.transactions import router as transactions_router
from app.config import settings
from app.utils.csrf import CSRFMiddleware
from app.utils.headers import SecurityHeadersMiddleware
from app.utils.logging import RequestLoggingMiddleware, setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.models import Base
    from app.models.base import engine

    # In production, rely on Alembic migrations. Only auto-create in dev.
    if settings.ENVIRONMENT != "production":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    logging.getLogger("talisman").info("Database tables ready")
    yield


def create_app() -> FastAPI:
    setup_logging()

    is_prod = settings.ENVIRONMENT == "production"
    # Docs disabled in production; in staging, require DOCS_ACCESS_TOKEN
    show_docs = not is_prod
    app = FastAPI(
        title="Talisman API",
        version="0.1.0",
        description="AI-powered micro-business assistant for Caribbean market vendors",
        lifespan=lifespan,
        debug=not is_prod,
        docs_url=None,  # We serve custom docs below
        redoc_url=None,
        openapi_url="/openapi.json" if show_docs else None,
    )

    # Self-hosted Swagger UI (no CDN dependency)
    if show_docs:
        import pathlib
        from fastapi.staticfiles import StaticFiles

        static_dir = pathlib.Path(__file__).resolve().parent.parent / "static"
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

        @app.get("/docs", include_in_schema=False)
        async def custom_docs():
            from fastapi.responses import HTMLResponse
            return HTMLResponse("""<!DOCTYPE html>
<html><head>
<link rel="stylesheet" href="/static/swagger-ui.css">
<link rel="icon" href="/static/favicon.png">
<title>Talisman API</title>
</head><body>
<div id="swagger-ui"></div>
<script src="/static/swagger-ui-bundle.js"></script>
<script src="/static/swagger-init.js"></script>
</body></html>""")

    # ── Production error handlers — no stack traces ──

    if is_prod:
        @app.exception_handler(Exception)
        async def generic_exception_handler(request: Request, exc: Exception):
            logging.getLogger("talisman").error("Unhandled error: %s", exc, exc_info=True)
            return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        # Always sanitize to avoid serialization issues with ValueError objects
        safe = [{"field": " -> ".join(str(loc) for loc in e.get("loc", [])), "message": e.get("msg", "Invalid")} for e in exc.errors()]
        return JSONResponse(status_code=422, content={"detail": safe})

    # Rate limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # HTTPS redirect in production
    if is_prod:
        from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
        app.add_middleware(HTTPSRedirectMiddleware)

    # Mitigate Starlette CVEs: Range header DoS + multipart upload DoS
    from app.utils.request_guard import RequestGuardMiddleware
    app.add_middleware(RequestGuardMiddleware)

    # NOTE: CSRF and SecurityHeaders middleware temporarily use a simpler approach
    # to avoid BaseHTTPMiddleware interfering with CORSMiddleware header injection.
    # CSRF protection
    app.add_middleware(CSRFMiddleware)

    # Security headers
    app.add_middleware(SecurityHeadersMiddleware)

    # CORS — must be OUTERMOST (added last = wraps everything)
    cors_kwargs: dict = {
        "allow_origins": settings.cors_origins_list,
        "allow_credentials": True,
        "expose_headers": ["set-cookie"],
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    # In non-production: allow localhost, private IPs, Railway domain, and Electron (null origin)
    if not is_prod:
        cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|.*\.up\.railway\.app|.*\.vercel\.app)(:\d+)?"
    app.add_middleware(CORSMiddleware, **cors_kwargs)

    # Request logging with correlation IDs
    app.add_middleware(RequestLoggingMiddleware)

    from app.api.assistant import router as assistant_router
    from app.api.public import router as public_router

    app.include_router(auth_router)
    app.include_router(products_router)
    app.include_router(transactions_router)
    app.include_router(credit_router)
    app.include_router(nlp_router)
    app.include_router(assistant_router)
    app.include_router(public_router)

    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    return app


app = create_app()
