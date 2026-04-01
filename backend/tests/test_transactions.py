import pytest
from httpx import AsyncClient

from tests.helpers import create_authed_vendor

pytestmark = pytest.mark.asyncio

PRODUCT_PAYLOAD = {
    "name": "Rice",
    "name_creole": "Diri",
    "unit": "sak",
    "current_price": "150.00",
    "stock_quantity": "20.00",
    "low_stock_threshold": "5.00",
}


async def _create_product(client: AsyncClient, headers: dict) -> str:
    resp = await client.post("/products", headers=headers, json=PRODUCT_PAYLOAD)
    return resp.json()["id"]


class TestListTransactions:
    async def test_empty(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        resp = await client.get("/transactions", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_filter_by_type(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        pid = await _create_product(client, headers)

        await client.post("/transactions", headers=headers, json={
            "product_id": pid, "transaction_type": "SALE",
            "quantity": "2.00", "unit_price": "150.00", "total_amount": "300.00",
        })
        await client.post("/transactions", headers=headers, json={
            "product_id": pid, "transaction_type": "PURCHASE",
            "quantity": "10.00", "unit_price": "120.00", "total_amount": "1200.00",
        })

        resp = await client.get("/transactions?type=SALE", headers=headers)
        assert len(resp.json()) == 1
        assert resp.json()[0]["transaction_type"] == "SALE"

    async def test_pagination(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        pid = await _create_product(client, headers)

        for i in range(5):
            await client.post("/transactions", headers=headers, json={
                "product_id": pid, "transaction_type": "SALE",
                "quantity": "1.00", "unit_price": "150.00", "total_amount": "150.00",
            })

        resp = await client.get("/transactions?limit=2&offset=0", headers=headers)
        assert len(resp.json()) == 2

        resp2 = await client.get("/transactions?limit=2&offset=2", headers=headers)
        assert len(resp2.json()) == 2


class TestCreateTransaction:
    async def test_sale_decrements_stock(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        pid = await _create_product(client, headers)

        resp = await client.post("/transactions", headers=headers, json={
            "product_id": pid, "transaction_type": "SALE",
            "quantity": "3.00", "unit_price": "150.00", "total_amount": "450.00",
        })
        assert resp.status_code == 201

        # Stock should be 20 - 3 = 17
        prod_resp = await client.get("/products", headers=headers)
        product = [p for p in prod_resp.json() if p["id"] == pid][0]
        assert product["stock_quantity"] == "17.00"

    async def test_sale_low_stock_warning(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        pid = await _create_product(client, headers)

        # Sell 16 of 20 → stock=4, below threshold=5
        resp = await client.post("/transactions", headers=headers, json={
            "product_id": pid, "transaction_type": "SALE",
            "quantity": "16.00", "unit_price": "150.00", "total_amount": "2400.00",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["low_stock_warning"] is not None
        assert "low stock" in data["low_stock_warning"].lower()

    async def test_purchase_increments_stock(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        pid = await _create_product(client, headers)

        await client.post("/transactions", headers=headers, json={
            "product_id": pid, "transaction_type": "PURCHASE",
            "quantity": "10.00", "unit_price": "120.00", "total_amount": "1200.00",
        })

        prod_resp = await client.get("/products", headers=headers)
        product = [p for p in prod_resp.json() if p["id"] == pid][0]
        assert product["stock_quantity"] == "30.00"

    async def test_no_warning_above_threshold(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        pid = await _create_product(client, headers)

        resp = await client.post("/transactions", headers=headers, json={
            "product_id": pid, "transaction_type": "SALE",
            "quantity": "1.00", "unit_price": "150.00", "total_amount": "150.00",
        })
        assert resp.json()["low_stock_warning"] is None


class TestBulkTransactions:
    async def test_bulk_success(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)
        pid = await _create_product(client, headers)

        items = [
            {
                "product_id": pid, "transaction_type": "SALE",
                "quantity": "1.00", "unit_price": "150.00", "total_amount": "150.00",
            },
            {
                "product_id": pid, "transaction_type": "SALE",
                "quantity": "2.00", "unit_price": "150.00", "total_amount": "300.00",
            },
        ]

        resp = await client.post("/transactions/bulk", headers=headers, json=items)
        assert resp.status_code == 200
        results = resp.json()["results"]
        assert len(results) == 2
        assert all(r["success"] for r in results)

        # Stock: 20 - 1 - 2 = 17
        prod_resp = await client.get("/products", headers=headers)
        product = [p for p in prod_resp.json() if p["id"] == pid][0]
        assert product["stock_quantity"] == "17.00"

    async def test_bulk_with_no_product(self, client: AsyncClient):
        _, headers = await create_authed_vendor(client)

        items = [
            {
                "transaction_type": "ADJUSTMENT",
                "quantity": "5.00", "unit_price": "0.00", "total_amount": "0.00",
                "notes": "Inventory correction",
            },
        ]

        resp = await client.post("/transactions/bulk", headers=headers, json=items)
        assert resp.status_code == 200
        assert resp.json()["results"][0]["success"] is True
