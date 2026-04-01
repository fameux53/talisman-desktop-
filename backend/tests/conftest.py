import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.base import Base

# In-memory SQLite for tests (synchronous driver wrapped by aiosqlite)
TEST_DB_URL = "sqlite+aiosqlite://"

engine_test = create_async_engine(TEST_DB_URL, echo=False)
async_session_test = async_sessionmaker(engine_test, class_=AsyncSession, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Fake Redis (in-process dict)
# ---------------------------------------------------------------------------

class FakeRedis:
    """Minimal Redis stand-in backed by a plain dict."""

    def __init__(self):
        self._store: dict[str, str] = {}

    async def setex(self, key: str, ttl: int, value: str):
        self._store[key] = value

    async def exists(self, key: str) -> int:
        return 1 if key in self._store else 0

    async def aclose(self):
        pass


_fake_redis = FakeRedis()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_tables():
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture()
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_test() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture()
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    from app.api.deps import get_db, get_redis
    from app.main import app

    async def _override_db():
        yield db_session

    async def _override_redis():
        yield _fake_redis

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_redis] = _override_redis

    # Disable rate limiting in tests
    from app.api.auth import limiter
    limiter.enabled = False

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Disable CSRF validation in functional tests (tested separately)
        from app.utils import csrf as csrf_mod
        csrf_mod._TESTING = True
        yield ac
        csrf_mod._TESTING = False

    limiter.enabled = True
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _clear_fake_redis():
    _fake_redis._store.clear()
