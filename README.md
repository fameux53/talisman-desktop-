# Talisman

**Business assistant for Caribbean market vendors.** Built for the informal economy where trust-based credit, cash transactions, and shared devices are the norm.

Talisman helps market vendors (machann) in Haiti track sales, manage inventory, handle customer credit, and run their business from a phone, tablet, or desktop.

## Features

- **Point of Sale** -- Record sales with cash, MonCash (mobile money), or credit
- **Inventory Management** -- Track stock, set low-stock alerts, archive products, bulk operations
- **Customer Credit** -- Track who owes what, send WhatsApp reminders, QR balance check
- **Employee System** -- Multi-user login with PIN, role-based permissions (owner/manager/assistant)
- **Reports & Analytics** -- Revenue, expenses, profit, top products, employee performance reports
- **Offline-First** -- Works without internet, syncs when connected
- **Multi-Location** -- Manage multiple market stalls from one account
- **Trilingual** -- Haitian Creole, French, English
- **AI Assistant** -- Smart business insights powered by local data analysis
- **Desktop App** -- Windows installer with auto-updates via GitHub Releases

## Architecture

```
frontend/          React + Vite PWA (offline-first, IndexedDB)
backend/           FastAPI + PostgreSQL + Redis (REST API)
desktop/           Electron (wraps frontend + SQLite for local data)
```

| Component | Tech |
|-----------|------|
| Frontend | React 19, TypeScript, Tailwind CSS, Zustand, IndexedDB (idb) |
| Backend | FastAPI, SQLAlchemy (async), PostgreSQL, Redis, Argon2, JWT |
| Desktop | Electron 33, better-sqlite3, electron-builder, auto-updater |
| PWA | Workbox, service worker, offline caching |

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Python 3.12+ and Poetry
- Docker & Docker Compose (optional, for full stack)

### Development

```bash
# Backend
cp backend/.env.example backend/.env
cd backend && poetry install
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend
cd frontend && npm install && npm run dev

# Desktop (optional)
cd desktop && npm install && npm run dev
```

### Docker (full stack)

```bash
docker compose up --build
```

| Service | Port |
|---------|------|
| FastAPI | 8000 |
| Frontend | 5173 (dev) / 80 (prod) |
| PostgreSQL | 5432 |
| Redis | 6379 |

### Desktop Build

```bash
cd frontend && npm run build
cd ../desktop && npx electron-builder --win --publish always
```

## Environment Variables

See `backend/.env.example` for all available configuration options including:
- Database, Redis, and secret key
- CORS origins
- SMS provider (Twilio) for PIN recovery
- MonCash integration for mobile payments
- Anthropic API key for AI assistant

## Deployment

- **Backend**: Deploy via Docker or any Python hosting (Railway, Render, etc.)
- **Frontend**: Static files in `frontend/dist/` -- deploy to any CDN or static host
- **Desktop**: Auto-updates via GitHub Releases

## Security

- Argon2 password hashing for owner PINs
- JWT with httpOnly cookies (access + refresh tokens)
- CSRF double-submit cookie protection
- Rate limiting on all auth endpoints
- Account lockout after failed attempts
- CSP, HSTS, X-Frame-Options security headers
- Production startup guards (rejects weak keys, insecure cookies, stub SMS)

## License

Proprietary. Copyright 2026 Mike Novius.
