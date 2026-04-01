import pytest
from httpx import AsyncClient

from tests.helpers import create_authed_vendor

pytestmark = pytest.mark.asyncio

PRODUCT_PAYLOAD = {
    "name": "Rice",
    "name_creole": "Diri",
    "unit": "sak",
    "current_price": "150.00",
    "stock_quantity": "50.00",
    "low_stock_threshold": "5.00",
}


class TestListProducts:
    async def test_empty_list(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        resp = await client.get("/products", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_lists_own_products_only(self, client: AsyncClient):
        _, h1 = await create_authed_vendor(client)
        _, h2 = await create_authed_vendor(client)

        await client.post("/products", headers=h1, json=PRODUCT_PAYLOAD)
        await client.post("/products", headers=h2, json={**PRODUCT_PAYLOAD, "name": "Beans"})

        r1 = await client.get("/products", headers=h1)
        assert len(r1.json()) == 1
        assert r1.json()[0]["name"] == "Rice"

    async def test_search_by_name(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        await client.post("/products", headers=headers, json=PRODUCT_PAYLOAD)
        await client.post("/products", headers=headers, json={**PRODUCT_PAYLOAD, "name": "Beans", "name_creole": "Pwa"})

        resp = await client.get("/products?search=pwa", headers=headers)
        assert len(resp.json()) == 1
        assert resp.json()[0]["name"] == "Beans"

    async def test_search_by_name_creole(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        await client.post("/products", headers=headers, json=PRODUCT_PAYLOAD)

        resp = await client.get("/products?search=diri", headers=headers)
        assert len(resp.json()) == 1


class TestCreateProduct:
    async def test_success(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        resp = await client.post("/products", headers=headers, json=PRODUCT_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Rice"
        assert data["unit"] == "sak"
        assert data["is_active"] is True

    async def test_no_auth_returns_403(self, client: AsyncClient):
        resp = await client.post("/products", json=PRODUCT_PAYLOAD)
        assert resp.status_code == 403


class TestUpdateProduct:
    async def test_partial_update(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        create_resp = await client.post("/products", headers=headers, json=PRODUCT_PAYLOAD)
        pid = create_resp.json()["id"]

        resp = await client.patch(f"/products/{pid}", headers=headers, json={"current_price": "175.00"})
        assert resp.status_code == 200
        assert resp.json()["current_price"] == "175.00"
        assert resp.json()["name"] == "Rice"  # unchanged

    async def test_other_vendor_cannot_update(self, client: AsyncClient):
        _, h1 = await create_authed_vendor(client)
        _, h2 = await create_authed_vendor(client)

        create_resp = await client.post("/products", headers=h1, json=PRODUCT_PAYLOAD)
        pid = create_resp.json()["id"]

        resp = await client.patch(f"/products/{pid}", headers=h2, json={"name": "Stolen"})
        assert resp.status_code == 404


class TestDeleteProduct:
    async def test_soft_delete(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        create_resp = await client.post("/products", headers=headers, json=PRODUCT_PAYLOAD)
        pid = create_resp.json()["id"]

        del_resp = await client.delete(f"/products/{pid}", headers=headers)
        assert del_resp.status_code == 204

        # Should no longer appear in active list
        list_resp = await client.get("/products", headers=headers)
        assert all(p["id"] != pid for p in list_resp.json())
