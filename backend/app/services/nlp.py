"""Rule-based Haitian Creole NLP parser for vendor commands."""

import enum
import re

from pydantic import BaseModel


class Intent(str, enum.Enum):
    RECORD_SALE = "RECORD_SALE"
    RECORD_PURCHASE = "RECORD_PURCHASE"
    CHECK_STOCK = "CHECK_STOCK"
    CHECK_CREDIT = "CHECK_CREDIT"
    ADD_CREDIT = "ADD_CREDIT"
    UNKNOWN = "UNKNOWN"


class IntentResult(BaseModel):
    intent: Intent
    product_name: str | None = None
    quantity: float | None = None
    unit: str | None = None
    unit_price: float | None = None
    customer_name: str | None = None
    amount: float | None = None
    raw_input: str
    confidence: float


# ---------------------------------------------------------------------------
# Number words → digits
# ---------------------------------------------------------------------------

_CREOLE_NUMBERS: dict[str, float] = {
    "yon": 1, "en": 1, "youn": 1,
    "de": 2, "dè": 2,
    "twa": 3, "twà": 3,
    "kat": 4,
    "senk": 5, "sink": 5,
    "sis": 6,
    "sèt": 7, "set": 7,
    "uit": 8, "wit": 8,
    "nèf": 9, "nef": 9,
    "dis": 10, "diz": 10,
}

_UNITS = {
    "mamit", "mamite",
    "sak",
    "douzèn", "douzen", "douzenn",
    "boutèy", "boutey",
    "bwat", "bwèt",
    "galon",
    "liv",
    "tas",
    "gwo", "ti",
    "pake", "pakè",
    "moso",
    "pyès", "pyes",
}


def _to_number(token: str) -> float | None:
    """Convert a token to a number, supporting Creole words and digits."""
    low = token.lower().strip()
    if low in _CREOLE_NUMBERS:
        return _CREOLE_NUMBERS[low]
    try:
        return float(low.replace(",", "."))
    except ValueError:
        return None


def _extract_price(text: str) -> float | None:
    """Extract price from 'a <N> goud' or 'pou <N> goud' or just '<N> goud'."""
    m = re.search(r"(?:a|pou|pa)\s+(\d{1,12}(?:[.,]\d{1,2})?)\s*(?:goud|gd|htg)?", text, re.I)
    if m:
        return float(m.group(1).replace(",", "."))
    m = re.search(r"(\d{1,12}(?:[.,]\d{1,2})?)\s*(?:goud|gd|htg)", text, re.I)
    if m:
        return float(m.group(1).replace(",", "."))
    return None


def _extract_amount(text: str) -> float | None:
    """Extract a monetary amount (e.g. '500 goud' or just a number near 'kont/kredi')."""
    m = re.search(r"(\d{1,12}(?:[.,]\d{1,2})?)\s*(?:goud|gd|htg)?", text, re.I)
    if m:
        return float(m.group(1).replace(",", "."))
    return None


def _extract_customer_name(text: str, *, strip_prefix: str = "") -> str | None:
    """Pull a customer name — typically 'Madanm X', 'Msye X', or a capitalized name."""
    cleaned = text
    if strip_prefix:
        cleaned = re.sub(re.escape(strip_prefix), "", cleaned, count=1, flags=re.I).strip()

    # Pattern: Madanm/Madam/Msye/Mèt + Name(s)
    m = re.search(
        r"((?:madanm|madam|msye|mèt|met|ti|manman)\s+[A-Za-z\u00C0-\u024F]+(?:\s+[A-Za-z\u00C0-\u024F]+)?)",
        cleaned,
        re.I,
    )
    if m:
        return _title_case(m.group(1).strip())

    # Fallback: look for a capitalized proper name (2+ chars, starts uppercase)
    m = re.search(r"\b([A-Z\u00C0-\u024F][a-z\u00E0-\u024F]+(?:\s+[A-Z\u00C0-\u024F][a-z\u00E0-\u024F]+)*)\b", cleaned)
    if m:
        candidate = m.group(1).strip()
        # Avoid matching Creole words that happen to be capitalized at sentence start
        skip = {"Mwen", "Konbyen", "Kisa", "Ban", "Kite", "Eske"}
        if candidate not in skip:
            return candidate
    return None


def _title_case(s: str) -> str:
    return " ".join(w.capitalize() for w in s.split())


# ---------------------------------------------------------------------------
# Sale / Purchase extraction
# ---------------------------------------------------------------------------

# Pattern: <verb> <qty> <unit> <product> (a <price> goud)?
# or:      <verb> <qty> <product> (a <price> goud)?
_SALE_VERBS = r"(?:vann|vand|vande|vann yo|te vann)"
_PURCHASE_VERBS = r"(?:achte|achete|te achte)"


def _parse_transaction(text: str, verb_pattern: str) -> dict:
    """Extract qty, unit, product_name, unit_price from a transaction phrase."""
    result: dict = {}

    # Remove the verb prefix to simplify downstream parsing
    m_verb = re.search(verb_pattern, text, re.I)
    if not m_verb:
        return result
    after_verb = text[m_verb.end():].strip()

    # Try: <number/word> <unit> <product> ...
    tokens = after_verb.split()
    idx = 0

    # Quantity
    if idx < len(tokens):
        qty = _to_number(tokens[idx])
        if qty is not None:
            result["quantity"] = qty
            idx += 1

    # Unit (optional)
    if idx < len(tokens) and tokens[idx].lower().rstrip("s") in _UNITS:
        result["unit"] = tokens[idx].lower().rstrip("s")
        idx += 1

    # Product name: consume tokens until we hit a price marker or end
    product_tokens: list[str] = []
    while idx < len(tokens):
        low = tokens[idx].lower()
        if low in ("a", "pou", "pa") or re.match(r"\d", tokens[idx]):
            break
        product_tokens.append(tokens[idx])
        idx += 1

    if product_tokens:
        result["product_name"] = " ".join(product_tokens).lower().strip(".,!?")

    # Price
    price = _extract_price(text)
    if price is not None:
        result["unit_price"] = price

    return result


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse_intent(text: str) -> IntentResult:
    """Parse a Haitian Creole vendor command into a structured IntentResult."""
    raw = text.strip()
    lowered = raw.lower()

    # --- ADD_CREDIT (check early: phrases with "sou kont" / "a kredi" take priority) ---
    if re.search(r"sou\s+kont|a\s+kredi", lowered):
        customer = _extract_customer_name(raw)
        amount = _extract_amount(lowered)
        confidence = 0.5
        if customer:
            confidence += 0.25
        if amount is not None:
            confidence += 0.25
        return IntentResult(
            intent=Intent.ADD_CREDIT,
            customer_name=customer,
            amount=amount,
            raw_input=raw,
            confidence=min(confidence, 1.0),
        )

    # --- RECORD_SALE ---
    if re.search(_SALE_VERBS, lowered):
        fields = _parse_transaction(lowered, _SALE_VERBS)
        confidence = 0.5
        if fields.get("product_name"):
            confidence += 0.2
        if fields.get("quantity") is not None:
            confidence += 0.15
        if fields.get("unit_price") is not None:
            confidence += 0.15
        return IntentResult(
            intent=Intent.RECORD_SALE,
            raw_input=raw,
            confidence=min(confidence, 1.0),
            **fields,
        )

    # --- RECORD_PURCHASE ---
    if re.search(_PURCHASE_VERBS, lowered):
        fields = _parse_transaction(lowered, _PURCHASE_VERBS)
        confidence = 0.5
        if fields.get("product_name"):
            confidence += 0.2
        if fields.get("quantity") is not None:
            confidence += 0.15
        if fields.get("unit_price") is not None:
            confidence += 0.15
        return IntentResult(
            intent=Intent.RECORD_PURCHASE,
            raw_input=raw,
            confidence=min(confidence, 1.0),
            **fields,
        )

    # --- CHECK_STOCK ---
    if re.search(r"konbyen\s+\S+(?:\s+\S+){0,10}\s*(?:genyen|rete|gen|nan\s+stòk|nan\s+stok)", lowered) or \
       re.search(r"(?:ki\s+kantite|konbyen)\s+\S+(?:\s+\S+){0,10}\s*(?:mwen|m)\s+gen", lowered):
        # Extract product name: everything between "konbyen" and the verb/question mark
        m = re.search(r"konbyen\s+(\S+(?:\s+\S+){0,10}?)(?:\s+(?:mwen|m)\s+gen|\s+rete|\s+nan\s+stò?k|\?|$)", lowered)
        product_name = m.group(1).strip(".,!? ") if m else None
        return IntentResult(
            intent=Intent.CHECK_STOCK,
            product_name=product_name,
            raw_input=raw,
            confidence=0.85 if product_name else 0.6,
        )

    # --- CHECK_CREDIT ---
    if re.search(r"(?:konbyen|konben)\s+\S+(?:\s+\S+){0,10}\s*(?:dwe|dwa)\s*(?:m|mwen)", lowered) or \
       re.search(r"(?:ki\s+sa|kisa)\s+\S+(?:\s+\S+){0,10}\s*dwe", lowered) or \
       re.search(r"kont\s+(?:madanm|madam|msye|mèt|met)", lowered, re.I):
        customer = _extract_customer_name(raw)
        return IntentResult(
            intent=Intent.CHECK_CREDIT,
            customer_name=customer,
            raw_input=raw,
            confidence=0.85 if customer else 0.6,
        )

    # --- UNKNOWN ---
    return IntentResult(
        intent=Intent.UNKNOWN,
        raw_input=raw,
        confidence=0.0,
    )
