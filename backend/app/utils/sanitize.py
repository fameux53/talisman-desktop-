"""Text sanitization for user inputs — strips XSS, control chars, normalizes Unicode."""

import html
import re
import unicodedata


# Control characters except tab, newline, carriage return
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


def sanitize_text(value: str) -> str:
    """Sanitize a user-supplied text string.

    1. Unicode NFC normalization (canonical composition).
    2. Strip control characters (keep \\n, \\t, \\r).
    3. Escape HTML entities (prevents stored XSS).
    4. Strip leading/trailing whitespace.
    """
    # Normalize Unicode
    value = unicodedata.normalize("NFC", value)
    # Remove control chars
    value = _CONTROL_RE.sub("", value)
    # Escape HTML
    value = html.escape(value, quote=True)
    # Strip whitespace
    return value.strip()
