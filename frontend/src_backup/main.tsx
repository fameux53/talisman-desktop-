import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// ── Service Worker Registration ──
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onRegisteredSW(swUrl, r) {
        console.log('[SW] Registered:', swUrl)
        // Check for updates every hour
        if (r) {
          setInterval(() => { r.update() }, 60 * 60 * 1000)
        }
      },
      onRegisterError(error) {
        console.error('[SW] Registration error:', error)
      },
    })
    // Store the update function globally so the app can trigger it
    ;(window as unknown as Record<string, unknown>).__updateSW = updateSW
  })
}
