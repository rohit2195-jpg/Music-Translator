import { API_BASE } from './ApiBase';

const STORAGE_KEY = 'spotify_auth';

export interface Auth {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms since epoch
}

function save(auth: Auth) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(auth)); } catch { /* storage blocked */ }
}

export function clearAuth() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
}

// the backend redirects back with #access_token=...&refresh_token=...&expires_in=...
export function readAuthFromHash(): Auth | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;

  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  const auth = {
    access_token,
    refresh_token,
    expires_at: Date.now() + Number(params.get('expires_in') || 3600) * 1000,
  };
  save(auth);
  return auth;
}

export function loadAuth(): Auth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function refreshAuth(auth: Auth): Promise<Auth | null> {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: auth.refresh_token }),
  });
  if (!response.ok) {
    clearAuth();
    return null;
  }

  const json = await response.json();
  const next = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + Number(json.expires_in || 3600) * 1000,
  };
  save(next);
  return next;
}
