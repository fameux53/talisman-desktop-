# Contributing to Talisman (MarketMama)

Thank you for your interest in contributing! Talisman is an AI-powered micro-business assistant for Caribbean market vendors, with a FastAPI backend and React frontend.

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 20+
- Poetry (Python package manager)
- Redis (or use `REDIS_URL=fake://` for local dev)
- PostgreSQL (or SQLite via aiosqlite for tests)

### Backend setup

```bash
cd backend
poetry install
cp .env.example .env  # edit with your local settings
poetry run uvicorn app.main:app --reload
```

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

### Running tests

```bash
cd backend
poetry run pytest -v
```

Tests use an in-memory SQLite database and a fake Redis implementation, so no external services are needed.

## Development workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Iterate on your branch.** Commit as often as you like during development.

3. **Squash before merging.** When your feature is ready, squash your commits into one or a few clean commits that describe the change clearly. This keeps `main` easy to bisect and review.

4. **Open a pull request** against `main`. CI will run linting (ruff), backend tests (pytest), and a frontend build check automatically.

5. **Do not push debug artifacts.** Remove `console.log`, `openDevTools()`, hardcoded test credentials, and similar before opening a PR.

## Architecture overview

The backend is a FastAPI application with these key design decisions:

- **Vendor isolation**: All data (products, transactions, credit entries) is scoped by `vendor_id`. Every query filters by the authenticated vendor's ID. This is enforced at the query level, not via middleware, so it cannot be bypassed.

- **Authentication**: Dual JWT tokens (access + refresh) stored in httpOnly cookies. PINs are hashed with Argon2. Accounts lock after 5 failed login attempts for 30 minutes.

- **CSRF protection**: Double-submit cookie pattern. The `tlsm_csrf_token` cookie is readable by JavaScript, and must be sent back as the `x-csrf-token` header on all state-changing requests (POST, PATCH, DELETE). Safe methods (GET, HEAD, OPTIONS) are exempt.

- **Rate limiting**: Per-endpoint limits via slowapi, keyed by IP address. Sensitive endpoints like login and PIN reset have stricter limits (3-5/minute or 3/hour).

- **Role-based access**: Three roles (owner, manager, assistant) with cascading permissions. Role checks are FastAPI dependencies (`require_owner`, `require_manager_or_owner`, `require_any_role`).

See [docs/api.md](docs/api.md) for full API documentation.

## Security considerations

If your change touches authentication, authorization, or data access:

- **Never bypass vendor isolation.** All database queries for user data must include a `vendor_id` filter.
- **Never expose tokens or secrets in responses.** JWTs go in httpOnly cookies, not response bodies (except refresh token in the login response for backward compatibility).
- **CSRF-exempt paths are intentional.** Only unauthenticated endpoints (login, register, health) skip CSRF validation. Do not add new exemptions without discussion.
- **Rate limits are security controls**, not just performance guards. The limits on auth endpoints prevent brute-force attacks.
- **Test security changes.** The `backend/tests/test_security.py` file contains OWASP-focused tests. Add cases for any new security behavior.

## Code style

- **Backend**: Python code is linted with [ruff](https://docs.astral.sh/ruff/). Run `ruff check .` before committing.
- **Frontend**: Standard React/TypeScript conventions. Run `npm run build` to catch type errors.
- Keep commits focused. One logical change per commit.

## Reporting security issues

Do not open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.
