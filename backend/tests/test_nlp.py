"""Tests for Haitian Creole NLP parser — unit tests + API integration."""

import pytest

from app.services.nlp import Intent, parse_intent

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Unit tests for parse_intent
# ---------------------------------------------------------------------------

class TestRecordSale:
    def test_full_sale(self):
        r = parse_intent("Mwen vann 5 mamit mayi a 250 goud")
        assert r.intent == Intent.RECORD_SALE
        assert r.product_name == "mayi"
        assert r.quantity == 5
        assert r.unit == "mamit"
        assert r.unit_price == 250
        assert r.confidence >= 0.9

    def test_sale_variant_vand(self):
        r = parse_intent("Mwen vand 3 sak diri a 1500 goud")
        assert r.intent == Intent.RECORD_SALE
        assert r.product_name == "diri"
        assert r.quantity == 3
        assert r.unit == "sak"
        assert r.unit_price == 1500

    def test_sale_no_price(self):
        r = parse_intent("Mwen vann 2 mamit pwa")
        assert r.intent == Intent.RECORD_SALE
        assert r.product_name == "pwa"
        assert r.quantity == 2
        assert r.unit_price is None
        assert r.confidence < 1.0

    def test_sale_creole_number_word(self):
        r = parse_intent("Mwen vann senk boutey luil")
        assert r.intent == Intent.RECORD_SALE
        assert r.quantity == 5
        assert r.unit == "boutey"
        assert r.product_name == "luil"

    def test_sale_without_unit(self):
        r = parse_intent("Mwen vann 10 zoranj a 50 goud")
        assert r.intent == Intent.RECORD_SALE
        assert r.product_name == "zoranj"
        assert r.quantity == 10
        assert r.unit_price == 50


class TestRecordPurchase:
    def test_full_purchase(self):
        r = parse_intent("Mwen achte 2 sak diri a 1500")
        assert r.intent == Intent.RECORD_PURCHASE
        assert r.product_name == "diri"
        assert r.quantity == 2
        assert r.unit == "sak"
        assert r.unit_price == 1500

    def test_purchase_variant_achete(self):
        r = parse_intent("Mwen achete yon galon luil a 800 goud")
        assert r.intent == Intent.RECORD_PURCHASE
        assert r.quantity == 1
        assert r.unit == "galon"
        assert r.product_name == "luil"
        assert r.unit_price == 800

    def test_purchase_no_price(self):
        r = parse_intent("Mwen achte twa sak siman")
        assert r.intent == Intent.RECORD_PURCHASE
        assert r.quantity == 3
        assert r.product_name == "siman"


class TestCheckStock:
    def test_basic_stock_check(self):
        r = parse_intent("Konbyen diri mwen genyen?")
        assert r.intent == Intent.CHECK_STOCK
        assert r.product_name == "diri"
        assert r.confidence >= 0.8

    def test_stock_check_rete(self):
        r = parse_intent("Konbyen mayi rete?")
        assert r.intent == Intent.CHECK_STOCK
        assert r.product_name == "mayi"

    def test_stock_check_m_gen(self):
        r = parse_intent("Konbyen sak diri m gen?")
        assert r.intent == Intent.CHECK_STOCK
        assert "diri" in r.product_name


class TestCheckCredit:
    def test_basic_credit_check(self):
        r = parse_intent("Konbyen Madanm Jean dwe m?")
        assert r.intent == Intent.CHECK_CREDIT
        assert r.customer_name is not None
        assert "Jean" in r.customer_name

    def test_credit_check_msye(self):
        r = parse_intent("Konbyen Msye Pierre dwe mwen?")
        assert r.intent == Intent.CHECK_CREDIT
        assert "Pierre" in r.customer_name


class TestAddCredit:
    def test_basic_add_credit(self):
        r = parse_intent("Madanm Jean pran 500 goud sou kont")
        assert r.intent == Intent.ADD_CREDIT
        assert r.customer_name is not None
        assert "Jean" in r.customer_name
        assert r.amount == 500
        assert r.confidence >= 0.9

    def test_add_credit_a_kredi(self):
        r = parse_intent("Msye Paul achte 300 goud a kredi")
        assert r.intent == Intent.ADD_CREDIT
        assert "Paul" in r.customer_name
        assert r.amount == 300

    def test_add_credit_no_goud(self):
        r = parse_intent("Madanm Rose pran 750 sou kont")
        assert r.intent == Intent.ADD_CREDIT
        assert r.amount == 750


class TestUnknown:
    def test_gibberish(self):
        r = parse_intent("allo ki jan ou ye")
        assert r.intent == Intent.UNKNOWN
        assert r.confidence == 0.0

    def test_empty_string(self):
        r = parse_intent("")
        assert r.intent == Intent.UNKNOWN


class TestEdgeCases:
    def test_mixed_french_creole_sale(self):
        """French 'j'ai vendu' shouldn't match, but Creole 'vann' should."""
        r = parse_intent("Mwen vann 4 mamit pistach a 300 goud")
        assert r.intent == Intent.RECORD_SALE
        assert r.product_name == "pistach"

    def test_preserves_raw_input(self):
        text = "  Konbyen diri mwen genyen?  "
        r = parse_intent(text)
        assert r.raw_input == text.strip()


# ---------------------------------------------------------------------------
# API integration test
# ---------------------------------------------------------------------------

class TestNlpEndpoint:
    async def test_parse_requires_auth(self, client):
        resp = await client.post("/nlp/parse", json={"text": "Mwen vann 5 mamit mayi"})
        assert resp.status_code == 403

    async def test_parse_returns_intent(self, client):
        from tests.helpers import create_authed_vendor

        _, headers = await create_authed_vendor(client)
        resp = await client.post(
            "/nlp/parse",
            headers=headers,
            json={"text": "Mwen vann 5 mamit mayi a 250 goud"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "RECORD_SALE"
        assert data["product_name"] == "mayi"
        assert data["quantity"] == 5
        assert data["unit"] == "mamit"
        assert data["unit_price"] == 250
