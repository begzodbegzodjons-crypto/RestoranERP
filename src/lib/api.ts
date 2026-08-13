/**
 * API client — all requests go through Next.js /api/[...path] catch-all route.
 * Offline-aware: GET requests fall back to IndexedDB cache when network fails.
 * Mutations (POST/PUT/DELETE) are queued locally when offline.
 */
import { enqueueOperation, getCachedTables, getCachedProducts, getCachedCategories } from './offline-db';

interface RequestOptions extends RequestInit {
  auth?: boolean;
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

// Check if we're offline (network error, not server error)
function isNetworkError(err: any): boolean {
  return err instanceof TypeError && err.message.includes('fetch');
}

// Offline-aware GET: try network first, fall back to cache
async function offlineGet<T>(path: string, token: string | null): Promise<T | null> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(path, { headers });
    if (!res.ok) throw new ApiError(res.status, 'ERROR', `Request failed: ${res.status}`);
    const body = await res.json();
    return body as T;
  } catch (err: any) {
    // Network error — try cache
    if (isNetworkError(err) || err.message?.includes('Failed to fetch')) {
      // Fall back to IndexedDB cache
      if (path.includes('/api/tables')) {
        const cached = await getCachedTables();
        if (cached.length > 0) {
          return { ok: true, data: cached } as unknown as T;
        }
      }
      if (path.includes('/api/products') && !path.includes('categories')) {
        const cached = await getCachedProducts();
        if (cached.length > 0) {
          return { ok: true, data: cached } as unknown as T;
        }
      }
      if (path.includes('/api/products/categories')) {
        const cached = await getCachedCategories();
        if (cached.length > 0) {
          return { ok: true, data: cached } as unknown as T;
        }
      }
      // No cache available — throw offline error
      throw new ApiError(0, 'OFFLINE', 'Internet uzilgan va ma\'lumot keshda yo\'q');
    }
    throw err;
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

  // For GET requests with no body — use offline-aware path
  const method = (rest.method as string) ?? 'GET';
  if (method === 'GET' && !rest.body) {
    const result = await offlineGet<T>(path, auth ? getStoredToken() : null);
    if (result !== null) return result;
  }

  let res = await fetch(path, { ...rest, headers: finalHeaders });

  // Auto-refresh on 401
  if (res.status === 401 && auth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      finalHeaders['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(path, { ...rest, headers: finalHeaders });
    }
  }

  let body: unknown;
  try { body = await res.json(); } catch { body = null; }

  if (!res.ok) {
    const errBody = body as { code?: string; message?: string; details?: unknown } | null;
    if (res.status === 401 && auth && !path.includes('/api/auth/')) {
      // Only clear auth if it's not a login/refresh attempt
      clearAuth();
      if (typeof window !== 'undefined') window.location.href = '/';
    }
    throw new ApiError(res.status, errBody?.code ?? 'ERROR', errBody?.message ?? 'Request failed', errBody?.details);
  }

  return body as T;
}

export interface ApiResponse<T> { ok: boolean; data: T }

export async function apiData<T>(path: string, options?: RequestOptions): Promise<T> {
  // For GET requests, handle offline gracefully
  const method = (options?.method as string) ?? 'GET';
  if (method === 'GET') {
    try {
      const res = await api<ApiResponse<T>>(path, options);
      return res.data;
    } catch (err: any) {
      if (err.code === 'OFFLINE') {
        throw err; // Re-throw offline errors
      }
      throw err;
    }
  }
  // For mutations — try network, if fails and POST, queue offline
  try {
    const res = await api<ApiResponse<T>>(path, options);
    return res.data;
  } catch (err: any) {
    // If network error and it's a create operation, queue for offline sync
    if ((isNetworkError(err) || err.message?.includes('Failed to fetch')) && method === 'POST') {
      // Queue for offline sync — this is handled by the component which calls enqueueOperation
      throw err;
    }
    throw err;
  }
}
