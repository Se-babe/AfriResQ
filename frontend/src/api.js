const TOKEN_KEY = 'afriresq_token';
const REFRESH_KEY = 'afriresq_refresh_token';
const USER_KEY = 'afriresq_user';

export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

function errorMessage(data, status) {
  if (!data) return `Request failed (${status})`;
  if (typeof data.error === 'string') return data.error;
  if (data.error?.formErrors) return data.error.formErrors.join(', ') || 'Invalid request';
  if (data.error?.fieldErrors) {
    const fields = Object.entries(data.error.fieldErrors)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ');
    return fields || 'Invalid request';
  }
  return `Request failed (${status})`;
}

async function rawRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const auth = token || localStorage.getItem(TOKEN_KEY);
  if (auth) headers.Authorization = `Bearer ${auth}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// The access token is short-lived by design (see backend JWT_EXPIRES_IN).
// On a 401 we transparently exchange the refresh token for a new access
// token and retry the request once, so a signed-in user isn't logged out
// just because their token expired mid-session. AuthProvider subscribes via
// onTokenRefreshed so React state (not just localStorage) stays in sync.
let refreshInFlight = null;
let tokenRefreshListener = null;

export function onTokenRefreshed(fn) {
  tokenRefreshListener = fn;
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = rawRequest('/auth/refresh', { method: 'POST', body: { refreshToken } })
      .then(({ res, data }) => {
        if (!res.ok) {
          clearAuth();
          return null;
        }
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(REFRESH_KEY, data.refreshToken);
        tokenRefreshListener?.(data.token, data.refreshToken);
        return data.token;
      })
      .catch(() => {
        clearAuth();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function api(path, options = {}) {
  const { res, data } = await rawRequest(path, options);
  if (res.ok) return data;

  const isAuthEndpoint = ['/auth/login', '/auth/register', '/auth/refresh'].some((p) => path.startsWith(p));
  if (res.status === 401 && !isAuthEndpoint) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retry = await rawRequest(path, { ...options, token: newToken });
      if (retry.res.ok) return retry.data;
      throw new Error(errorMessage(retry.data, retry.res.status));
    }
  }
  throw new Error(errorMessage(data, res.status));
}

export function readStoredAuth() {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      refreshToken: localStorage.getItem(REFRESH_KEY),
      user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
    };
  } catch {
    return { token: null, refreshToken: null, user: null };
  }
}

export function storeAuth(token, user, refreshToken) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}
