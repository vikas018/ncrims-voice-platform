/**
 * Thin fetch wrapper. Attaches the JWT, parses JSON, throws on non-2xx
 * with the server's error message. Kept dependency-free on purpose.
 */
const TOKEN_KEY = 'ncrims_token';
const API_BASE_KEY = 'ncrims_api_base';

/**
 * Backend URL. A value saved in the browser (Server settings on the login
 * screen) wins over the build-time VITE_API_BASE — so when the backend URL
 * changes (e.g. a Back4App redeploy), you just paste the new one in the UI,
 * no frontend rebuild needed. Read fresh on every request.
 */
export const apiBase = {
  // Priority: a manual override (from the login URL box) ONLY if set,
  // otherwise the Vercel build-time env var (the correct, default way).
  get: () => (localStorage.getItem(API_BASE_KEY) || import.meta.env.VITE_API_BASE || '').replace(/\/+$/, ''),
  set: (u) => localStorage.setItem(API_BASE_KEY, String(u || '').trim().replace(/\/+$/, '')),
  clear: () => localStorage.removeItem(API_BASE_KEY),
  envDefault: () => (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, ''),
  isOverride: () => Boolean(localStorage.getItem(API_BASE_KEY)),
};

const TOKEN = TOKEN_KEY;
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN),
  set: (t) => localStorage.setItem(TOKEN, t),
  clear: () => localStorage.removeItem(TOKEN),
};

async function request(method, path, { body, isForm } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (isForm) {
    payload = body; // FormData — let the browser set the boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${apiBase.get()}/api${path}`, { method, headers, body: payload });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    if (res.status === 401) tokenStore.clear();
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, body) => request('POST', p, { body }),
  patch: (p, body) => request('PATCH', p, { body }),
  del: (p) => request('DELETE', p),
  postForm: (p, formData) => request('POST', p, { body: formData, isForm: true }),
};

export default api;
