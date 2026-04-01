# Talisman Security Overview

## Authentication
- PIN-based auth with Argon2id hashing (6-digit, common PIN blocklist enforced)
- JWT tokens stored in httpOnly secure cookies (SameSite=Strict)
- Account lockout after 5 failed attempts (30 minutes)
- Progressive delay on failed login attempts (0s → 1s → 2s → 4s → lockout)
- Rate limiting: 5 requests/minute per IP on login (SlowAPI)
- Token expiry: access token 60 min, refresh token 7 days

## Data Protection
- Sensitive IndexedDB fields encrypted with AES-GCM 256-bit (Web Crypto API)
  - Encrypted: customer names, phone numbers, descriptions
  - Non-extractable key stored in separate IndexedDB keystore
- Server-side input sanitization on all text fields (Unicode NFC normalization, HTML entity escaping, control char stripping)
- No PII in server logs (phone numbers masked via `mask_phone()`)
- HTTPS enforced in production with HSTS preload (`max-age=31536000; includeSubDomains; preload`)

## CSRF Protection
- Double-submit cookie pattern on all state-changing endpoints (POST/PUT/PATCH/DELETE)
- `tlsm_csrf_token` cookie (not httpOnly, JS-readable) validated against `X-CSRF-Token` header
- SameSite=Strict on all auth cookies as additional CSRF layer
- Auth endpoints exempt (no cookie exists pre-login)

## Content Security Policy
- `default-src 'none'` — deny all by default
- `script-src 'self'` — no inline scripts, no external scripts
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` — unsafe-inline required for React `style={{}}` props (documented)
- `img-src 'self' data: blob:` — self + data URIs for icons
- `font-src 'self' https://fonts.gstatic.com` — Google Fonts only
- `connect-src 'self'` — API calls to same origin only
- `object-src 'none'` — blocks Flash/Java plugins
- `frame-ancestors 'none'` — clickjacking prevention (+ X-Frame-Options: DENY fallback)
- `base-uri 'self'` — prevents base tag injection
- `manifest-src 'self'` — PWA manifest
- `worker-src 'self'` — service worker

## API Security
- Swagger/OpenAPI docs disabled in production (`ENVIRONMENT=production`)
- Generic error responses in production — no file paths, no stack traces
- Validation errors sanitized in production — only field names + messages, no raw input
- Vendor isolation enforced via JWT — `vendor_id` always extracted from token, never trusted from client
- Bulk endpoints enforce auth and override client-supplied `vendor_id`
- `--no-server-header` on uvicorn hides server identity

## Frontend Security
- React JSX auto-escaping — no `dangerouslySetInnerHTML` anywhere (ESLint enforced)
- DOMPurify available for any dynamic HTML rendering
- ESLint rules: `no-eval: error`, `no-implied-eval: error`, `no-new-func: error`
- Source maps disabled in production builds (`build.sourcemap: false`)
- Production nginx blocks dotfiles (`/.env`, `/.git`) and `.map` files
- ErrorBoundary catches unhandled React errors with friendly UI

## Production Deployment
- Frontend served via nginx (multi-stage Docker build, no source code in image)
- Backend served via uvicorn with `--no-server-header`
- HTTPS redirect middleware enabled in production
- Cookie `Secure` flag enabled in production (`COOKIE_SECURE=true`)
- HSTS preload ready — submit to hstspreload.org after production launch

## Reporting Vulnerabilities
Please report security vulnerabilities to the project maintainers.
