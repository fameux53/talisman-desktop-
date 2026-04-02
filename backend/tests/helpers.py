"""Shared test helpers for registering a vendor and obtaining auth."""

from httpx import AsyncClient

_COUNTER = 0


def _extract_cookie(resp, name: str) -> str:
    """Extract a cookie value from a response's set-cookie headers."""
    for hv in resp.headers.get_list("set-cookie"):
        if hv.startswith(f"{name}="):
            return hv.split("=", 1)[1].split(";")[0]
    return ""


async def _get_csrf(client: AsyncClient) -> str:
    """Make a GET request to obtain a CSRF cookie."""
    resp = await client.get("/health")
    return _extract_cookie(resp, "tlsm_csrf_token")


async def create_authed_vendor(client: AsyncClient) -> tuple[dict, dict]:
    """Register a fresh vendor and log in. Returns (vendor_data, auth_headers).

    Handles:
    - httpOnly auth cookies (extracted from set-cookie)
    - CSRF token (obtained from GET /health, sent as header)
    """
    global _COUNTER
    _COUNTER += 1
    phone = f"+5093700{_COUNTER:04d}"

    # Get CSRF token first
    csrf = await _get_csrf(client)

    reg = await client.post("/auth/register", json={
        "phone_number": phone,
        "display_name": f"Vendor {_COUNTER}",
        "pin": "135790",
        "preferred_language": "HT",
    })
    vendor_data = reg.json().get("vendor", reg.json())

    login = await client.post("/auth/login", json={
        "phone_number": phone,
        "pin": "135790",
    })

    # Extract access token from cookie
    token = _extract_cookie(login, "tlsm_access_token")
    # Also get the fresh CSRF token set by the login response
    csrf = _extract_cookie(login, "tlsm_csrf_token") or csrf

    headers = {
        "Authorization": f"Bearer {token}",
        "X-CSRF-Token": csrf,
    }
    # Also set the CSRF cookie on the client for subsequent requests
    client.cookies.set("tlsm_csrf_token", csrf)

    return vendor_data, headers
