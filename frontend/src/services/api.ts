import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'tlsm_at';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send httpOnly cookies automatically
});

// ---------------------------------------------------------------------------
// Token helpers — fallback for desktop app where Secure cookies can't be set
// ---------------------------------------------------------------------------

export function setAccessToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Request interceptor — attach Bearer token + CSRF token
// ---------------------------------------------------------------------------

api.interceptors.request.use((config) => {
  // Attach stored token as Bearer header (desktop fallback)
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  const method = (config.method || '').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('tlsm_csrf_token='))
      ?.split('=')[1];
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — auto-refresh on 401
// ---------------------------------------------------------------------------

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: () => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown) {
  for (const { resolve, reject } of pendingQueue) {
    if (error) reject(error);
    else resolve();
  }
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Don't retry auth endpoints
    if (original.url?.includes('/auth/')) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then(() => api(original));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      await axios.post(
        `${api.defaults.baseURL}/auth/refresh`,
        {},
        { withCredentials: true },
      );
      processQueue(null);
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError);
      clearAccessToken();
      // Clear auth state
      const { useAuthStore } = await import('../stores/authStore');
      useAuthStore.getState().clearVendor();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
