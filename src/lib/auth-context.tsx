'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, getStoredToken, getStoredUser, setAuth, clearAuth, ApiError } from './api';
import type { User, LoginResponse } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start with null on both server and client to avoid hydration mismatch.
  // Then useEffect populates from localStorage on client only.
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On mount: read localStorage and verify token
  useEffect(() => {
    let cancelled = false;
    const token = getStoredToken();
    const storedUser = getStoredUser();

    if (!token) {
      setLoading(false);
      return;
    }

    // Optimistically show stored user while verifying
    if (storedUser) {
      setUser(storedUser);
    }

    api<{ ok: boolean; data: User }>('/api/auth/me')
      .then(res => {
        if (!cancelled) {
          setUser(res.data);
          const refreshToken = localStorage.getItem('pos_refresh_token');
          if (token && refreshToken) setAuth(token, refreshToken, res.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearAuth();
          setUser(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const res = await api<{ ok: boolean; data: LoginResponse }>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ phone, password }),
    });
    setAuth(res.data.accessToken, res.data.refreshToken, res.data.user);
    // Store in IndexedDB for offline access
    try {
      const { storeOfflineSession } = await import('./offline-db');
      await storeOfflineSession(res.data.user, res.data.accessToken, res.data.refreshToken);
    } catch {}
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: localStorage.getItem('pos_refresh_token') }),
      });
    } catch (e) {
      // Ignore errors on logout
    }
    clearAuth();
    setUser(null);
    router.push('/');
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api<{ ok: boolean; data: User }>('/api/auth/me');
      setUser(res.data);
      const token = getStoredToken();
      const refreshToken = localStorage.getItem('pos_refresh_token');
      if (token && refreshToken) setAuth(token, refreshToken, res.data);
    } catch (e) {
      // ignore
    }
  }, []);

  const hasPermission = useCallback((perm: string) => {
    if (!user) return false;
    if (user.permissions.includes('*')) return true;
    if (user.permissions.includes(perm)) return true;
    const wildcard = perm.split('.')[0] + '.*';
    return user.permissions.includes(wildcard);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
