# Talisman Frontend

React PWA for Talisman — offline-first business assistant for market vendors.

## Tech Stack

- React 19 + TypeScript
- Vite 8 (build + dev server)
- Tailwind CSS 4
- Zustand (state management)
- IndexedDB via `idb` (offline data)
- Workbox (service worker + offline caching)
- React Router (SPA routing)
- Recharts (reports/charts)

## Environment Variables

```bash
# .env (development)
VITE_API_URL=http://localhost:8000

# .env.production (deployment)
VITE_API_URL=https://your-api-domain.com
```

## Development

```bash
npm install
npm run dev        # Starts Vite dev server on :5173
```

## Production Build

```bash
npm run build      # TypeScript check + Vite build → dist/
npm run preview    # Preview production build locally
```

## Project Structure

```
src/
  components/    UI components (Layout, SideNav, Receipt, etc.)
  pages/         Route pages (Home, Sales, Inventory, Reports, etc.)
  services/      Data layer (api.ts, db.ts, dataLayer.ts)
  stores/        Zustand stores (auth, sync, theme, location)
  hooks/         Custom React hooks
  i18n/          Translations (ht.json, fr.json, en.json)
  utils/         Helpers (currency, date, crypto, sanitize)
```

## Key Architecture Decisions

- **Offline-first**: All data stored in IndexedDB, synced to backend when online
- **dataLayer abstraction**: Routes between IndexedDB (browser/PWA) and SQLite IPC (Electron)
- **Trilingual**: Haitian Creole (default), French, English — 800+ translation keys
- **PWA**: Installable, works offline, service worker caches API responses
