import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // send httpOnly cookies automatically
});

// ---------------------------------------------------------------------------
// Request interceptor — attach CSRF token on state-changing requests
// ---------------------------------------------------------------------------

api.interceptors.request.use((config) => {
  const method = (config.method || '').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('mm_csrf_token='))
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
