# Talisman API Documentation

Base URL: `https://your-deployment.railway.app` (production) or `http://localhost:8000` (local dev)

Interactive Swagger docs are available at `/docs` in development environments only.

---

## Design Principles

### Vendor Isolation

Every vendor's data is completely isolated. Products, transactions, and credit entries all carry a `vendor_id` foreign key. All queries filter by the authenticated vendor's ID, and all writes auto-assign it. There is no admin endpoint that crosses vendor boundaries.

This means a valid JWT for Vendor A cannot access Vendor B's data — the query simply returns no rows, and the API returns 404 (not 403), to avoid leaking the existence of other vendors' resources.

### Authentication Model

Talisman uses a dual-token JWT system designed for cookie-based auth (no localStorage):

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| Access token | 60 min | `tlsm_access_token` httpOnly cookie | API authorization |
| Refresh token | 7 days | `tlsm_refresh_token` httpOnly cookie | Silent token renewal |

Both tokens are HS256-signed JWTs containing `vendor_id`, `role`, and optionally `employee_id`. The access token is validated on every API call via the `get_current_user` dependency.

Token extraction priority: `Authorization: Bearer <token>` header first, then the httpOnly cookie. This allows both browser-based and programmatic clients.

**Logout invalidation**: On logout, both tokens are added to a Redis blacklist with TTL matching their remaining lifetime. Every token validation checks this blacklist.

### CSRF Protection

State-changing requests (POST, PATCH, DELETE, PUT) require a CSRF token using the double-submit cookie pattern:

1. The server sets a `tlsm_csrf_token` cookie (readable by JavaScript, SameSite=strict).
2. The client reads this cookie and sends its value as the `x-csrf-token` header.
3. The server verifies they match.

**Exempt paths** (unauthenticated endpoints where CSRF doesn't apply):
`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/forgot-pin/*`, `/auth/check-phone`, `/health`

### Rate Limiting

All endpoints are rate-limited by client IP via slowapi. Limits are tuned per-endpoint based on sensitivity:

- **Auth endpoints**: 3-5/minute (login, register) or 3/hour (PIN reset request)
- **Read endpoints**: 60/minute (products, transactions)
- **Write endpoints**: 10-30/minute
- **AI chat**: 10/minute

Exceeding a limit returns `429 Too Many Requests` with a `detail` message.

### Role-Based Access

Three roles with cascading permissions:

| Role | Can read data | Can write data | Can manage products | Can view credit |
|------|--------------|---------------|--------------------|-----------------| 
| **owner** | Yes | Yes | Yes | Yes |
| **manager** | Yes | Yes | Yes | Yes |
| **assistant** | Yes | Yes (transactions only) | No | No |

Roles are encoded in the JWT and enforced via FastAPI dependencies.

---

## Authentication Endpoints

### POST /auth/register

Create a new vendor account.

**Rate limit**: 5/minute

```json
// Request
{
  "phone_number": "+50937001234",
  "display_name": "Ti Machann",
  "pin": "1234",
  "preferred_language": "ht"
}

// Response 201
{
  "vendor": { "id": "uuid", "phone_number": "+50937001234", "display_name": "Ti Machann" }
}
// Sets tlsm_access_token and tlsm_refresh_token cookies
```

### POST /auth/login

Authenticate a vendor owner or employee.

**Rate limit**: 5/minute

```json
// Owner login
{
  "phone_number": "+50937001234",
  "pin": "1234"
}

// Employee login
{
  "phone_number": "+50937001234",
  "pin": "5678",
  "employee_id": "emp-001",
  "role": "manager"
}

// Response 200
{
  "vendor": { "id": "uuid", "display_name": "Ti Machann" },
  "role": "owner",
  "employee_id": null
}
```

**Security behavior**:
- Progressive delay after failed attempts (0s, 1s, 2s, 4s, 4s)
- Account locks for 30 minutes after 5 consecutive failures
- Lockout resets on successful login

### POST /auth/refresh

Refresh an expired access token using a valid refresh token.

**Rate limit**: 20/minute

The refresh token is read from the `tlsm_refresh_token` cookie. A new access token cookie is set on success.

### POST /auth/logout

Invalidate the current session. Blacklists both tokens in Redis.

**Rate limit**: 10/minute. Returns 204 No Content.

### GET /auth/me

Return the current authenticated user's vendor info, role, and employee ID.

**Rate limit**: 30/minute

### PIN Recovery

Three-step SMS-based flow or a single-step security question fallback:

| Endpoint | Rate Limit | Purpose |
|----------|-----------|---------|
| POST /auth/forgot-pin/request | 3/hour | Send 6-digit code via SMS |
| POST /auth/forgot-pin/verify | 10/hour | Verify code, receive reset token |
| POST /auth/forgot-pin/reset | 5/hour | Set new PIN using reset token |
| POST /auth/forgot-pin/security-question | 5/hour | Offline fallback via security Q&A |

The SMS endpoint is phone-enumeration-safe: it always returns success regardless of whether the phone exists.

---

## Products

All product endpoints require authentication. Products are soft-deleted (`is_active = false`).

| Method | Path | Role Required | Rate Limit | Description |
|--------|------|---------------|-----------|-------------|
| GET | /products | Any | 60/min | List vendor's active products. Supports `?search=` filter. |
| POST | /products | Manager+ | 30/min | Create a product. |
| PATCH | /products/{id} | Manager+ | 30/min | Update a product. |
| DELETE | /products/{id} | Manager+ | 20/min | Soft-delete a product. |

```json
// POST /products
{
  "name": "Rice",
  "name_creole": "Diri",
  "unit": "lb",
  "current_price": 75.00,
  "stock_quantity": 200,
  "low_stock_threshold": 20
}
```

---

## Transactions

| Method | Path | Role Required | Rate Limit | Description |
|--------|------|---------------|-----------|-------------|
| GET | /transactions | Any | 60/min | List transactions. Supports `?type=`, `?date_from=`, `?date_to=`, `?limit=`, `?offset=`. |
| POST | /transactions | Any | 60/min | Record a sale, purchase, or adjustment. Auto-updates stock. |
| POST | /transactions/bulk | Any | 10/min | Record up to 100 transactions atomically. |

Stock changes are applied automatically: sales decrement, purchases increment. The response includes low-stock warnings when applicable.

```json
// POST /transactions
{
  "transaction_type": "SALE",
  "product_id": "uuid",
  "quantity": 5,
  "unit_price": 75.00,
  "total_amount": 375.00,
  "notes": "Regular customer"
}
```

---

## Credit Management

Credit endpoints require manager or owner role.

| Method | Path | Role Required | Rate Limit | Description |
|--------|------|---------------|-----------|-------------|
| GET | /credit | Manager+ | 30/min | List credit entries grouped by customer with balances. |
| GET | /credit/summary | Manager+ | 30/min | Total outstanding, unique customers, overdue count. |
| POST | /credit | Manager+ | 30/min | Record credit given or payment received. |
| PATCH | /credit/{id} | Manager+ | 30/min | Update a credit entry. |
| POST | /credit/balance-token | Manager+ | 30/min | Generate a shareable balance link for a customer. |

### Public Balance Link

**GET /credit/balance/{vendor_id}/{token}** (no auth required, rate limit: 10/min)

Returns a single customer's balance and last 5 entries. Designed for vendors to share a link with customers so they can check their balance without logging in. The token is stored in Redis with a 90-day TTL.

---

## AI Assistant

### POST /assistant/chat

Proxy to Claude API for business advice in Haitian Creole.

**Role**: Any authenticated user. **Rate limit**: 10/minute.

```json
// Request
{
  "message": "Ki jan pou m ogmante vant mwen?",
  "context": { "products": [...], "recent_sales": [...] },
  "history": []
}

// Response
{
  "reply": "..."
}
```

The API key is server-side only — never sent to or exposed in the frontend.

---

## Natural Language Processing

### POST /nlp/parse

Parse a natural-language input into a structured intent (e.g., "sell 5 lb rice" becomes a sale intent with product and quantity).

**Role**: Any authenticated user. **Rate limit**: 30/minute.

---

## Middleware Stack

Requests pass through these layers (outermost first):

1. **CORS** — Configured origins, credentials enabled
2. **Security Headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
3. **CSRF** — Double-submit cookie validation on state-changing methods
4. **Request Guard** — Mitigates Starlette CVE-2024-47874 (Range header) and CVE-2024-47824 (multipart size)
5. **Request Logging** — Structured JSON logs with correlation IDs, PII masking for phone numbers
6. **HTTPS Redirect** — Production only

---

## Environment Configuration

Key environment variables (see `backend/app/config.py`):

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgresql+asyncpg://... | Database connection string |
| REDIS_URL | redis://localhost:6379/0 | Redis URL (`fake://` for in-memory dev) |
| SECRET_KEY | (required) | JWT signing key. Must be 32+ chars in production. |
| ENVIRONMENT | development | `development`, `staging`, or `production` |
| COOKIE_SECURE | false | Must be `true` in production (HTTPS-only cookies) |
| ANTHROPIC_API_KEY | (empty) | Claude API key for /assistant/chat |
| SMS_PROVIDER | stub | `stub`, `digicel`, or `natcom` |

**Production safety checks** (enforced at startup): SECRET_KEY length and uniqueness, COOKIE_SECURE=true, real Redis URL, no localhost CORS origins, non-stub SMS provider.
