'use client';

import { useOffline } from '@/lib/offline-context';
import { Wifi, WifiOff, RefreshCw, Check, AlertCircle, CloudUpload } from 'lucide-react';
import { useState } from 'react';

export function OfflineIndicator() {
  const { online, pendingCount, syncing, triggerSync } = useOffline();
  const [dismissed, setDismissed] = useState(false);

  if (online && pendingCount === 0) return null;
  if (online && syncing && dismissed) return null;

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${
      !online
        ? 'bg-red-600 text-white'
        : syncing
        ? 'bg-blue-600 text-white'
        : 'bg-amber-500 text-white'
    }`}>
      {!online ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Internet uzilgan</span>
          {pendingCount > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{pendingCount} navbatda</span>}
        </>
      ) : syncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Sinxronizatsiya...</span>
        </>
      ) : (
        <>
          <CloudUpload className="h-4 w-4" />
          <span>{pendingCount} ta amal navbatda</span>
          <button
            onClick={() => triggerSync()}
            className="bg-white/20 px-2 py-0.5 rounded-full text-xs hover:bg-white/30 transition-colors"
          >
            Yuborish
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-white/70 hover:text-white"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
