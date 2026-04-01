# Talisman

AI-powered micro-business assistant for Caribbean market vendors.

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ and npm (for local frontend development)
- Python 3.12+ and Poetry (for local backend development)

## Setup

1. Clone the repository:

```bash
git clone <repo-url> && cd talisman
```

2. Copy the backend environment file:

```bash
cp backend/.env.example backend/.env
```

3. Install frontend dependencies (for local development):

```bash
cd frontend && npm install
```

4. Install backend dependencies (for local development):

```bash
cd backend && poetry install
```

## Running with Docker

Start all services:

```bash
docker compose up --build
```

This starts:

| Service       | Port |
|---------------|------|
| FastAPI       | 8000 |
| PostgreSQL    | 5432 |
| Redis         | 6379 |
| Celery Worker | —    |
| Celery Beat   | —    |

Health check: [http://localhost:8000/health](http://localhost:8000/health)

Frontend dev server (run separately):

```bash
cd frontend && npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173).
