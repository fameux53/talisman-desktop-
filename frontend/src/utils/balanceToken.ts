/**
 * Generate a cryptographically random balance token for customer balance links.
 * Uses Web Crypto API for proper randomness. The token is stored alongside the
 * customer record in IndexedDB and should be looked up by exact match.
 */
export function generateBalanceToken(_vendorId: string, _customerName: string): string {
  // Generate 12 random bytes → 16-char base64url string
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  // Convert to URL-safe base64 (no padding)
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return base64;
}

/**
 * Generate the full balance check URL for a customer.
 */
export function getBalanceUrl(vendorId: string, customerName: string): string {
  const token = generateBalanceToken(vendorId, customerName);
  const base = window.location.origin;
  return `${base}/balance/${vendorId}/${token}`;
}

/**
 * Generate a WhatsApp share URL with a pre-filled message.
 */
export function getWhatsAppShareUrl(
  customerPhone: string | null,
  vendorName: string,
  customerName: string,
  balance: number,
  balanceUrl: string,
  currency: string,
): string {
  const phone = customerPhone?.replace(/[^0-9]/g, '') ?? '';
  const msg = [
    `Bonjou ${customerName}! 👋`,
    ``,
    `Men balans kont ou kay ${vendorName}:`,
    `💰 ${balance.toLocaleString()} ${currency}`,
    ``,
    `Tcheke balans ou nenpòt lè isit:`,
    `👉 ${balanceUrl}`,
    ``,
    `— ${vendorName} (via Talisman)`,
  ].join('\n');

  const encoded = encodeURIComponent(msg);
  return phone
    ? `https://wa.me/${phone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}
