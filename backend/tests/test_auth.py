import pytest
from httpx import AsyncClient

from tests.helpers import _extract_cookie

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _register(client: AsyncClient, phone: str = "+50937001234", pin: str = "135790"):
    return await client.post("/auth/register", json={
        "phone_number": phone,
        "display_name": "Marie Test",
        "pin": pin,
        "preferred_language": "HT",
    })


async def _login(client: AsyncClient, phone: str = "+50937001234", pin: str = "135790"):
    return await client.post("/auth/login", json={
        "phone_number": phone,
        "pin": pin,
    })


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

class TestRegister:
    async def test_success(self, client: AsyncClient):
        resp = await _register(client, phone="+50937000001")
        assert resp.status_code == 201
        data = resp.json()["vendor"]
        assert data["phone_number"] == "+50937000001"
        assert data["display_name"] == "Marie Test"
        assert "pin_hash" not in data
        assert "id" in data

    async def test_duplicate_phone_rejected(self, client: AsyncClient):
        await _register(client, phone="+50937000002")
        resp = await _register(client, phone="+50937000002")
        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"].lower()

    async def test_invalid_pin_format(self, client: AsyncClient):
        resp = await client.post("/auth/register", json={
            "phone_number": "+50937000099",
            "display_name": "Bad Pin",
            "pin": "12",  # too short
        })
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class TestLogin:
    async def test_success(self, client: AsyncClient):
        await _register(client, phone="+50937001001")
        resp = await _login(client, phone="+50937001001")
        assert resp.status_code == 200
        # Tokens are in httpOnly cookies, vendor in body
        assert "vendor" in resp.json()
        assert _extract_cookie(resp, "tlsm_access_token") != ""
        assert _extract_cookie(resp, "tlsm_refresh_token") != ""

    async def test_wrong_pin(self, client: AsyncClient):
        await _register(client, phone="+50937001002")
        resp = await _login(client, phone="+50937001002", pin="999999")
        assert resp.status_code == 401

    async def test_lockout_after_5_failures(self, client: AsyncClient):
        await _register(client, phone="+50937001003")
        for _ in range(5):
            resp = await _login(client, phone="+50937001003", pin="999999")
            assert resp.status_code == 401

        # 6th attempt should be locked
        resp = await _login(client, phone="+50937001003", pin="135790")
        assert resp.status_code == 423
        assert "locked" in resp.json()["detail"].lower()

    async def test_nonexistent_phone(self, client: AsyncClient):
        resp = await _login(client, phone="+50900000000", pin="135790")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------


class TestRefresh:
    async def test_refresh_returns_new_access_token(self, client: AsyncClient):
        await _register(client, phone="+50937002001")
        login_resp = await _login(client, phone="+50937002001")
        refresh_token = _extract_cookie(login_resp, "tlsm_refresh_token")

        resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200

    async def test_refresh_with_access_token_fails(self, client: AsyncClient):
        """Using an access token as a refresh token should fail."""
        await _register(client, phone="+50937002002")
        login_resp = await _login(client, phone="+50937002002")
        access_token = _extract_cookie(login_resp, "tlsm_access_token")

        # Send ONLY the access token as refresh (clear any cookies by using headers)
        resp = await client.post(
            "/auth/refresh",
            json={"refresh_token": access_token},
            cookies={"tlsm_refresh_token": access_token},  # force wrong token type
        )
        assert resp.status_code == 401

    async def test_refresh_with_garbage_fails(self, client: AsyncClient):
        resp = await client.post("/auth/refresh", json={"refresh_token": "garbage"})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Logout / blacklisting
# ---------------------------------------------------------------------------

class TestLogout:
    async def test_logout_blacklists_token(self, client: AsyncClient):
        await _register(client, phone="+50937003001")
        login_resp = await _login(client, phone="+50937003001")
        access_token = _extract_cookie(login_resp, "tlsm_access_token")
        headers = {"Authorization": f"Bearer {access_token}"}

        # Logout
        resp = await client.post("/auth/logout", headers=headers)
        assert resp.status_code == 204

        # Using the same token again should fail
        resp = await client.post("/auth/logout", headers=headers)
        assert resp.status_code == 401

    async def test_logout_without_token_fails(self, client: AsyncClient):
        resp = await client.post("/auth/logout")
        assert resp.status_code == 401
