'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { isOnline, onOnlineStatusChange, syncQueue, startAutoSync, stopAutoSync, setSyncCallbacks } from './sync-engine';
import { countPending, storeOfflineSession, getOfflineSession } from './offline-db';

interface OfflineContextValue {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  triggerSync: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPending = useCallback(async () => {
    try {
      const count = await countPending();
      setPendingCount(count);
    } catch {}
  }, []);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncQueue();
    } finally {
      setSyncing(false);
      await refreshPending();
    }
  }, [refreshPending]);

  useEffect(() => {
    // Set initial online status
    setOnline(isOnline());

    // Listen for online/offline events
    const unsub = onOnlineStatusChange((isOnline) => {
      setOnline(isOnline);
      if (isOnline) {
        // Auto-sync when back online
        triggerSync();
      }
    });

    // Set up sync callbacks
    setSyncCallbacks({
      onComplete: () => refreshPending(),
      onPendingChange: (count: number) => setPendingCount(count),
    });

    // Initial pending count
    refreshPending();

    // Start auto-sync loop
    startAutoSync();

    // Also restore offline session on mount (if localStorage has token but IndexedDB doesn't have user)
    if (typeof window !== 'undefined') {
      getOfflineSession().then(session => {
        if (!session) {
          // Try to store from localStorage
          const token = localStorage.getItem('pos_access_token');
          const userStr = localStorage.getItem('pos_user');
          const refresh = localStorage.getItem('pos_refresh_token');
          if (token && userStr) {
            try {
              storeOfflineSession(JSON.parse(userStr), token, refresh ?? '');
            } catch {}
          }
        }
      });
    }

    return () => {
      unsub();
      stopAutoSync();
    };
  }, [refreshPending, triggerSync]);

  return (
    <OfflineContext.Provider value={{ online, pendingCount, syncing, triggerSync }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
}
