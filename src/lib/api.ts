/**
 * API client — all requests go through Next.js /api/[...path] catch-all route,
 * which proxies them to the backend Express server (port 4000).
 * Frontend never sees DB credentials.
 */

interface RequestOptions extends RequestInit {
  auth?: boolean;       // include Bearer token
  idempotencyKey?: string;
}

const TOKEN_KEY = 'pos_access_token';
const REFRESH_KEY = 'pos_refresh_token';
const USER_KEY = 'pos_user';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): { id: string; name: string; phone: string; restaurantId: string; roleId?: string; roleName?: string; permissions: string[] } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAuth(accessToken: string, refreshToken: string, user: unknown): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.ok) return null;
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, json.data.accessToken);
      localStorage.setItem(REFRESH_KEY, json.data.refreshToken);
    }
    return json.data.accessToken;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { auth = true, idempotencyKey, headers = {}, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };
  if (auth) {
    const token = getStoredToken();
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  }
  if (idempotencyKey) {
    finalHeaders['Idempotency-Key'] = idempotencyKey;
  }

  // Use relative path — Next.js /api/[...path] will proxy to backend
  const url = path.startsWith('http') ? path : path;

  let res = await fetch(url, { ...rest, headers: finalHeaders });

  // Auto-refresh on 401
  if (res.status === 401 && auth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      finalHeaders['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...rest, headers: finalHeaders });
    }
  }

  let body: unknown;
  try { body = await res.json(); } catch { body = null; }

  if (!res.ok) {
    const errBody = body as { code?: string; message?: string; details?: unknown } | null;
    if (res.status === 401 && auth) {
      clearAuth();
      if (typeof window !== 'undefined') window.location.href = '/';
    }
    throw new ApiError(res.status, errBody?.code ?? 'ERROR', errBody?.message ?? 'Request failed', errBody?.details);
  }

  return body as T;
}

export interface ApiResponse<T> { ok: boolean; data: T }
export interface ApiListResponse<T> { ok: boolean; data: { items: T[]; total: number; page: number; limit: number } }

export async function apiData<T>(path: string, options?: RequestOptions): Promise<T> {
  const res = await api<ApiResponse<T>>(path, options);
  return res.data;
}
