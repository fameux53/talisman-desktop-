from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://mama:changeme@localhost:5432/talisman"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    SMS_GATEWAY_URL: str = ""
    SMS_API_KEY: str = ""
    SMS_PROVIDER: str = "stub"  # stub | digicel | natcom
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    ENVIRONMENT: str = "development"  # development | staging | production
    DOCS_ACCESS_TOKEN: str = ""  # Set for protected docs access in staging
    COOKIE_SECURE: bool = False  # True in production (HTTPS only)
    ANTHROPIC_API_KEY: str = ""  # Claude API key for AI assistant

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

# Refuse to start in production with a weak SECRET_KEY
if settings.ENVIRONMENT == "production" and (
    "change" in settings.SECRET_KEY.lower()
    or len(settings.SECRET_KEY) < 32
):
    raise RuntimeError(
        "FATAL: SECRET_KEY is insecure. Set a strong, random SECRET_KEY (>= 32 chars) for production."
    )

# Refuse to start in production with insecure cookie settings
if settings.ENVIRONMENT == "production" and not settings.COOKIE_SECURE:
    raise RuntimeError(
        "FATAL: COOKIE_SECURE must be True in production (HTTPS-only cookies)."
    )

# Refuse to start in production with stub SMS provider (leaks recovery codes to logs)
if settings.ENVIRONMENT == "production" and settings.SMS_PROVIDER in ("stub", "mock"):
    raise RuntimeError(
        "FATAL: SMS_PROVIDER cannot be 'stub' or 'mock' in production. "
        "Set SMS_PROVIDER=twilio and configure Twilio credentials."
    )

# Refuse to start in production with localhost CORS origins
if settings.ENVIRONMENT == "production" and any("localhost" in o for o in settings.CORS_ORIGINS):
    raise RuntimeError(
        "FATAL: CORS_ORIGINS contains localhost. Set real domain(s) for production."
    )

# Refuse to start in production with fake Redis
if settings.ENVIRONMENT == "production" and settings.REDIS_URL.startswith("fake://"):
    raise RuntimeError(
        "FATAL: REDIS_URL cannot be 'fake://' in production. Use a real Redis instance."
    )
