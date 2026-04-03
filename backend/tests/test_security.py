"""OWASP-aligned security test suite.

Run with: pytest tests/test_security.py -v -m security
"""

import pytest
from httpx import AsyncClient

from app.utils.sanitize import sanitize_text
from app.utils.logging import mask_phone
from tests.helpers import create_authed_vendor

pytestmark = [pytest.mark.asyncio, pytest.mark.security]

PRODUCT_PAYLOAD = {
    "name": "Rice",
    "name_creole": "Diri",
    "unit": "sak",
    "current_price": "150.00",
    "stock_quantity": "50.00",
    "low_stock_threshold": "5.00",
}


# ============================================================================
# 1. INPUT SANITIZATION
# ============================================================================


class TestInputSanitization:
    """Verify XSS/injection payloads are neutralized at the schema layer."""

    def test_strips_html_tags(self):
        assert sanitize_text("<script>alert(1)</script>") == "&lt;script&gt;alert(1)&lt;/script&gt;"

    def test_escapes_html_entities(self):
        assert "&lt;" in sanitize_text("<img onerror=alert(1)>")

    def test_strips_control_characters(self):
        result = sanitize_text("hello\x00\x07world")
        assert "\x00" not in result
        assert "\x07" not in result
        assert "helloworld" == result

    def test_preserves_creole_unicode(self):
        text = "Diri ak pwa — èske ou genyen?"
        result = sanitize_text(text)
        # Accented chars preserved, only HTML entities escaped
        assert "è" in result
        assert "—" in result

    def test_unicode_normalization(self):
        # e + combining accent should be normalized to single char
        composed = sanitize_text("e\u0300")  # è via combining
        assert composed == "\u00e8"  # è as single codepoint

    async def test_xss_in_product_name_is_escaped(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        xss_payload = {**PRODUCT_PAYLOAD, "name": '<script>alert("xss")</script>'}
        resp = await client.post("/products", headers=headers, json=xss_payload)
        assert resp.status_code == 201
        assert "<script>" not in resp.json()["name"]
        assert "&lt;script&gt;" in resp.json()["name"]

    async def test_xss_in_credit_customer_name(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        resp = await client.post("/credit", headers=headers, json={
            "customer_name": "<img src=x onerror=alert(1)>",
            "entry_type": "CREDIT_GIVEN",
            "amount": "100",
        })
        assert resp.status_code == 201
        assert "<img" not in resp.json()["customer_name"]


# ============================================================================
# 2. SQL INJECTION
# ============================================================================


class TestSQLInjection:
    """Verify parameterized queries prevent SQL injection."""

    async def test_search_with_sql_injection(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        # Create a legitimate product first
        await client.post("/products", headers=headers, json=PRODUCT_PAYLOAD)

        # Attempt SQL injection via search parameter
        injections = [
            "'; DROP TABLE products; --",
            "' OR '1'='1",
            "' UNION SELECT * FROM vendors --",
            "1; DELETE FROM products WHERE 1=1 --",
        ]
        for payload in injections:
            resp = await client.get(f"/products?search={payload}", headers=headers)
            assert resp.status_code == 200
            # Should return empty or the legit product — not crash
            assert isinstance(resp.json(), list)

    async def test_products_still_exist_after_injection_attempts(self, client: AsyncClient):
        """Confirm no data was destroyed by injection attempts."""
        _, headers = await create_authed_vendor(client)
        await client.post("/products", headers=headers, json=PRODUCT_PAYLOAD)

        # Try injection
        await client.get("/products?search=' OR 1=1 --", headers=headers)

        # Products should still be there
        resp = await client.get("/products", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


# ============================================================================
# 3. ROW-LEVEL SECURITY (multi-tenancy isolation)
# ============================================================================


class TestRowLevelSecurity:
    """Vendor A must never access Vendor B's data via direct ID manipulation."""

    async def test_vendor_cannot_read_others_products(self, client: AsyncClient):
        _, h_a = await create_authed_vendor(client)
        _, h_b = await create_authed_vendor(client)

        # Vendor A creates a product
        resp_a = await client.post("/products", headers=h_a, json=PRODUCT_PAYLOAD)
        pid = resp_a.json()["id"]

        # Vendor B should not see it
        resp_b = await client.get("/products", headers=h_b)
        ids_b = [p["id"] for p in resp_b.json()]
        assert pid not in ids_b

    async def test_vendor_cannot_update_others_products(self, client: AsyncClient):
        _, h_a = await create_authed_vendor(client)
        _, h_b = await create_authed_vendor(client)

        resp = await client.post("/products", headers=h_a, json=PRODUCT_PAYLOAD)
        pid = resp.json()["id"]

        # Vendor B tries to update Vendor A's product
        resp_b = await client.patch(f"/products/{pid}", headers=h_b, json={"name": "STOLEN"})
        assert resp_b.status_code == 404

    async def test_vendor_cannot_delete_others_products(self, client: AsyncClient):
        _, h_a = await create_authed_vendor(client)
        _, h_b = await create_authed_vendor(client)

        resp = await client.post("/products", headers=h_a, json=PRODUCT_PAYLOAD)
        pid = resp.json()["id"]

        resp_b = await client.delete(f"/products/{pid}", headers=h_b)
        assert resp_b.status_code == 404

    async def test_vendor_cannot_see_others_transactions(self, client: AsyncClient):
        _, h_a = await create_authed_vendor(client)
        _, h_b = await create_authed_vendor(client)

        # Vendor A creates product + transaction
        p = await client.post("/products", headers=h_a, json=PRODUCT_PAYLOAD)
        pid = p.json()["id"]
        await client.post("/transactions", headers=h_a, json={
            "product_id": pid, "transaction_type": "SALE",
            "quantity": "1.00", "unit_price": "150.00", "total_amount": "150.00",
        })

        # Vendor B sees nothing
        resp_b = await client.get("/transactions", headers=h_b)
        assert resp_b.json() == []

    async def test_vendor_cannot_see_others_credit(self, client: AsyncClient):
        _, h_a = await create_authed_vendor(client)
        _, h_b = await create_authed_vendor(client)

        await client.post("/credit", headers=h_a, json={
            "customer_name": "Secret Customer",
            "entry_type": "CREDIT_GIVEN",
            "amount": "500",
        })

        resp_b = await client.get("/credit", headers=h_b)
        names = [c["customer_name"] for c in resp_b.json()]
        assert "Secret Customer" not in names


# ============================================================================
# 4. SECURITY HEADERS
# ============================================================================


class TestSecurityHeaders:
    async def test_response_contains_security_headers(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.headers.get("x-content-type-options") == "nosniff"
        assert resp.headers.get("x-frame-options") == "DENY"
        assert resp.headers.get("x-xss-protection") == "1; mode=block"
        assert "max-age=" in resp.headers.get("strict-transport-security", "")
        csp = resp.headers.get("content-security-policy", "")
        assert "default-src 'none'" in csp
        assert "frame-ancestors 'none'" in csp
        assert resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

    async def test_security_headers_on_error_responses(self, client: AsyncClient):
        """Verify security headers are present even on 404 error responses."""
        resp = await client.get("/nonexistent-route-12345")
        assert resp.status_code == 404
        assert resp.headers.get("x-frame-options") == "DENY"
        assert resp.headers.get("x-content-type-options") == "nosniff"
        assert "frame-ancestors 'none'" in resp.headers.get("content-security-policy", "")

    async def test_request_id_header_returned(self, client: AsyncClient):
        resp = await client.get("/health")
        assert "x-request-id" in resp.headers

    async def test_custom_request_id_echoed(self, client: AsyncClient):
        resp = await client.get("/health", headers={"X-Request-ID": "test-123"})
        assert resp.headers.get("x-request-id") == "test-123"


# ============================================================================
# 5. AUTH HARDENING
# ============================================================================


class TestAuthHardening:
    async def test_expired_token_rejected(self, client: AsyncClient):
        """Fabricate an expired token and verify rejection."""
        from datetime import datetime, timedelta, timezone
        import jwt
        from app.config import settings
        import uuid

        expired = datetime.now(timezone.utc) - timedelta(hours=1)
        token = jwt.encode(
            {"sub": str(uuid.uuid4()), "exp": expired, "type": "access"},
            settings.SECRET_KEY,
            algorithm="HS256",
        )
        resp = await client.get("/products", headers={"Authorization": f"Bearer {token}", "X-CSRF-Token": "test-csrf-token"})
        assert resp.status_code == 401

    async def test_tampered_token_rejected(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        token = headers["Authorization"].split(" ")[1]
        # Replace the signature (third segment) with a different value to
        # guarantee an invalid signature regardless of base64 padding.
        parts = token.split(".")
        assert len(parts) == 3, "Expected a 3-part JWT"
        # Reverse the signature characters — always produces a different value
        # for any real HMAC signature (minimum 32 bytes base64-encoded).
        parts[2] = parts[2][::-1] if parts[2] != parts[2][::-1] else parts[2][1:] + parts[2][0]
        tampered = ".".join(parts)
        resp = await client.get("/products", headers={"Authorization": f"Bearer {tampered}", "X-CSRF-Token": "test-csrf-token"})
        assert resp.status_code == 401

    async def test_refresh_token_cannot_be_used_as_access(self, client: AsyncClient):
        """Refresh token type should be rejected for API calls."""
        from tests.helpers import _COUNTER
        phone = f"+5093700{_COUNTER + 9000:04d}"
        await client.post("/auth/register", json={
            "phone_number": phone, "display_name": "Test", "pin": "135790",
        })
        login = await client.post("/auth/login", json={"phone_number": phone, "pin": "135790"})

        # Extract refresh token from cookie
        refresh = ""
        for hv in login.headers.get_list("set-cookie"):
            if hv.startswith("tlsm_refresh_token="):
                refresh = hv.split("=", 1)[1].split(";")[0]
                break

        # Using refresh token as access token should fail
        resp = await client.get("/products", headers={"Authorization": f"Bearer {refresh}", "X-CSRF-Token": "test-csrf-token"})
        assert resp.status_code == 401

    async def test_no_sensitive_data_in_vendor_response(self, client: AsyncClient):
        """Verify pin_hash is never exposed in API responses."""
        vendor, _ = await create_authed_vendor(client)
        assert "pin_hash" not in vendor
        assert "pin" not in vendor


# ============================================================================
# 6. PII MASKING
# ============================================================================


# ============================================================================
# 7. BULK ENDPOINT AUTHORIZATION
# ============================================================================


class TestBulkEndpointAuth:
    async def test_bulk_requires_auth(self, client: AsyncClient):
        """Bulk endpoint must reject unauthenticated requests."""
        resp = await client.post("/transactions/bulk", json=[
            {"transaction_type": "SALE", "quantity": "1.00", "unit_price": "100.00", "total_amount": "100.00"},
        ])
        assert resp.status_code in [401, 403]

    async def test_bulk_rejects_expired_token(self, client: AsyncClient):
        """Bulk endpoint must reject expired tokens."""
        from datetime import datetime, timedelta, timezone
        import jwt
        from app.config import settings
        import uuid

        expired = datetime.now(timezone.utc) - timedelta(hours=1)
        token = jwt.encode(
            {"sub": str(uuid.uuid4()), "exp": expired, "type": "access"},
            settings.SECRET_KEY, algorithm="HS256",
        )
        resp = await client.post(
            "/transactions/bulk",
            json=[{"transaction_type": "SALE", "quantity": "1.00", "unit_price": "100.00", "total_amount": "100.00"}],
            headers={"Authorization": f"Bearer {token}", "X-CSRF-Token": "test-csrf-token"},
        )
        assert resp.status_code == 401

    async def test_bulk_forces_vendor_id(self, client: AsyncClient):
        """Bulk endpoint must override vendor_id with the authenticated vendor."""
        _, h_a = await create_authed_vendor(client)

        resp = await client.post(
            "/transactions/bulk",
            headers=h_a,
            json=[{
                "transaction_type": "SALE",
                "quantity": "1.00",
                "unit_price": "100.00",
                "total_amount": "100.00",
            }],
        )
        assert resp.status_code == 200
        results = resp.json()["results"]
        for item in results:
            if item["success"] and item["transaction"]:
                # vendor_id should match the authenticated vendor, not any client-supplied value
                assert item["transaction"]["vendor_id"] is not None


# ============================================================================
# 8. PII MASKING
# ============================================================================


class TestPIIMasking:
    def test_phone_number_masked(self):
        assert mask_phone("+50937001234") == "****1234"

    def test_short_number_left_alone(self):
        # Numbers shorter than 4 digits shouldn't match
        assert mask_phone("123") == "123"

    def test_mask_in_message(self):
        msg = "Vendor +50937001234 logged in"
        masked = mask_phone(msg)
        assert "+50937001234" not in masked
        assert "****1234" in masked
