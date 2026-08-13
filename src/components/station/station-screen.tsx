'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { apiData, ApiError } from '@/lib/api';
import type { StationQueueItem } from '@/lib/types';
import { Loader2, RefreshCw, Flame, CheckCircle2, XCircle, Clock, ChefHat, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StationScreenProps {
  station: 'kitchen' | 'kebab';
  title: string;
  accentColor: 'orange' | 'red';
}

const POLL_INTERVAL = 3000; // 3 seconds

const ACCENT_STYLES = {
  orange: {
    headerBg: 'bg-orange-600',
    headerText: 'text-orange-600',
    lightBg: 'bg-orange-50',
    border: 'border-orange-200',
    chip: 'bg-orange-100 text-orange-700',
  },
  red: {
    headerBg: 'bg-red-600',
    headerText: 'text-red-600',
    lightBg: 'bg-red-50',
    border: 'border-red-200',
    chip: 'bg-red-100 text-red-700',
  },
} as const;

export function StationScreen({ station, title, accentColor }: StationScreenProps) {
  const [items, setItems] = useState<StationQueueItem[]>([]);
  const [cancelledItems, setCancelledItems] = useState<StationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const audioAlertRef = useRef<HTMLAudioElement | null>(null);

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [activeRes, cancelledRes] = await Promise.all([
        apiData<StationQueueItem[]>(`/api/station/${station}/queue`),
        apiData<StationQueueItem[]>(`/api/station/${station}/cancelled`),
      ]);
      const newActive = activeRes ?? [];
      const newCancelled = cancelledRes ?? [];

      // Detect new pending items (compared to previous state)
      if (!silent && items.length > 0) {
        const prevPendingIds = new Set(
          items.filter(i => i.status === 'pending').map(i => i.order_item_id)
        );
        const newPendingItems = newActive.filter(
          i => i.status === 'pending' && !prevPendingIds.has(i.order_item_id)
        );
        if (newPendingItems.length > 0) {
          toast.info(`${newPendingItems.length} ta yangi buyurtma!`, {
            description: newPendingItems.map(i => i.product_name).slice(0, 3).join(', '),
          });
          // Try to play a sound (if audio element exists)
          if (audioAlertRef.current) {
            audioAlertRef.current.play().catch(() => {});
          }
        }
      }

      setItems(newActive);
      setCancelledItems(newCancelled);
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof ApiError ? err.message : 'Navbat yuklanmadi');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [station, items]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(() => fetchQueue(true), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [station]);

  const updateItemStatus = async (itemId: string, status: 'cooking' | 'ready' | 'served') => {
    setUpdatingItemId(itemId);
    try {
      await apiData(`/api/station/order-items/${itemId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      // Optimistic update — move item to next column immediately
      setItems(prev => prev.map(it =>
        it.order_item_id === itemId
          ? {
              ...it,
              status,
              started_at: status === 'cooking' ? new Date().toISOString() : it.started_at,
              ready_at: status === 'ready' ? new Date().toISOString() : it.ready_at,
            }
          : it
      ));
      toast.success(
        status === 'cooking' ? 'Tayyorlanmoqda' :
        status === 'ready' ? 'Tayyor!' :
        'Berildi'
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Status yangilanmadi');
      // Refresh to get actual state
      fetchQueue(true);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const cancelItem = async (itemId: string, reason: string) => {
    setUpdatingItemId(itemId);
    try {
      await apiData(`/api/station/order-items/${itemId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      // Move to cancelled column
      setItems(prev => prev.filter(it => it.order_item_id !== itemId));
      // Re-fetch to get updated cancelled list
      fetchQueue(true);
      toast.success('Buyurtma bekor qilindi');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Bekor qilib bo\'lmadi');
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Group items by status
  const columns: Record<string, StationQueueItem[]> = {
    pending: [],
    cooking: [],
    ready: [],
  };
  for (const it of items) {
    if (columns[it.status]) columns[it.status].push(it);
  }

  const accent = ACCENT_STYLES[accentColor];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 py-4">
      {/* Hidden audio element for new-order alert */}
      <audio ref={audioAlertRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" type="audio/wav" />
      </audio>

      {/* Header */}
      <div className={`${accent.headerBg} text-white rounded-xl p-4 mb-4 shadow-md`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              {station === 'kitchen' ? <ChefHat className="h-6 w-6" /> : <Flame className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-lg font-bold">{title}</h1>
              <p className="text-xs text-white/80">
                {lastUpdated ? `Oxirgi yangilanish: ${lastUpdated.toLocaleTimeString('uz-UZ')}` : 'Yuklanmoqda...'}
                {' · '}
                {POLL_INTERVAL / 1000}s polling
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-center">
              <div className="font-bold text-xl">{columns.pending.length}</div>
              <div className="text-[10px] uppercase">Yangi</div>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div className="text-center">
              <div className="font-bold text-xl">{columns.cooking.length}</div>
              <div className="text-[10px] uppercase">Tayyor.</div>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div className="text-center">
              <div className="font-bold text-xl">{columns.ready.length}</div>
              <div className="text-[10px] uppercase">Tayyor</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchQueue()}
            disabled={refreshing}
            className="text-white hover:bg-white/20"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 4-column board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Column 1: Yangi (pending) */}
        <Column
          title="Yangi"
          icon={Clock}
          iconColor="text-slate-600"
          headerBg="bg-slate-100"
          count={columns.pending.length}
        >
          {columns.pending.map(item => (
            <OrderItemCard
              key={item.order_item_id}
              item={item}
              accent={accent}
              updating={updatingItemId === item.order_item_id}
              actions={[
                { label: 'Tayyorlanyapti', status: 'cooking', variant: 'primary' },
              ]}
              onAction={(status) => updateItemStatus(item.order_item_id, status)}
              onCancel={(reason) => cancelItem(item.order_item_id, reason)}
            />
          ))}
          {columns.pending.length === 0 && <EmptyColumn label="Yangi buyurtma yo'q" />}
        </Column>

        {/* Column 2: Tayyorlanmoqda (cooking) */}
        <Column
          title="Tayyorlanmoqda"
          icon={ChefHat}
          iconColor="text-amber-600"
          headerBg="bg-amber-50"
          count={columns.cooking.length}
        >
          {columns.cooking.map(item => (
            <OrderItemCard
              key={item.order_item_id}
              item={item}
              accent={accent}
              updating={updatingItemId === item.order_item_id}
              actions={[
                { label: 'Tayyor', status: 'ready', variant: 'success' },
              ]}
              onAction={(status) => updateItemStatus(item.order_item_id, status)}
              onCancel={(reason) => cancelItem(item.order_item_id, reason)}
            />
          ))}
          {columns.cooking.length === 0 && <EmptyColumn label="Tayyorlanayotgan yo'q" />}
        </Column>

        {/* Column 3: Tayyor (ready) */}
        <Column
          title="Tayyor"
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          headerBg="bg-emerald-50"
          count={columns.ready.length}
        >
          {columns.ready.map(item => (
            <OrderItemCard
              key={item.order_item_id}
              item={item}
              accent={accent}
              updating={updatingItemId === item.order_item_id}
              actions={[
                { label: 'Berildi', status: 'served', variant: 'info' },
              ]}
              onAction={(status) => updateItemStatus(item.order_item_id, status)}
              onCancel={(reason) => cancelItem(item.order_item_id, reason)}
            />
          ))}
          {columns.ready.length === 0 && <EmptyColumn label="Tayyor taom yo'q" />}
        </Column>

        {/* Column 4: Bekor (cancelled) */}
        <Column
          title="Bekor"
          icon={XCircle}
          iconColor="text-red-600"
          headerBg="bg-red-50"
          count={cancelledItems.length}
        >
          {cancelledItems.map(item => (
            <CancelledItemCard key={item.order_item_id} item={item} />
          ))}
          {cancelledItems.length === 0 && <EmptyColumn label="Bekor qilingan yo'q" />}
        </Column>
      </div>
    </div>
  );
}

function Column({
  title, icon: Icon, iconColor, headerBg, count, children,
}: {
  title: string;
  icon: typeof Clock;
  iconColor: string;
  headerBg: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className={`${headerBg} rounded-xl border border-slate-200 overflow-hidden flex flex-col`}>
      <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
        </div>
        <span className="bg-white text-slate-700 text-xs font-bold px-2 py-0.5 rounded-full border border-slate-200">
          {count}
        </span>
      </div>
      <div className="p-2 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function EmptyColumn({ label }: { label: string }) {
  return (
    <div className="text-center py-8 text-slate-400 text-xs">{label}</div>
  );
}

interface OrderItemCardProps {
  item: StationQueueItem;
  accent: typeof ACCENT_STYLES.orange;
  updating: boolean;
  actions: Array<{ label: string; status: 'cooking' | 'ready' | 'served'; variant: 'primary' | 'success' | 'info' }>;
  onAction: (status: 'cooking' | 'ready' | 'served') => void;
  onCancel: (reason: string) => void;
}

function OrderItemCard({ item, accent, updating, actions, onAction, onCancel }: OrderItemCardProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [reason, setReason] = useState('');

  const ageSeconds = Number(item.age_seconds ?? 0);
  const ageMin = Math.floor(ageSeconds / 60);
  const ageSec = ageSeconds % 60;
  const isOverdue = item.urgency === 'overdue';
  const isWarning = item.urgency === 'warning';

  const variantStyles = {
    primary: 'bg-slate-900 hover:bg-slate-800 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 text-white',
  };

  return (
    <div className={`bg-white rounded-lg border ${isOverdue ? 'border-red-300' : isWarning ? 'border-amber-300' : 'border-slate-200'} shadow-sm overflow-hidden`}>
      {/* Urgency indicator */}
      {(isOverdue || isWarning) && (
        <div className={`px-2 py-0.5 text-[10px] font-bold uppercase flex items-center gap-1 ${
          isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
        }`}>
          <AlertTriangle className="h-3 w-3" />
          {isOverdue ? 'Juda kech!' : 'Tezroq!'}
        </div>
      )}

      <div className="p-2.5">
        {/* Order # + table */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold text-slate-900">#{item.order_number}</span>
            {item.table_name && (
              <span className={`${accent.chip} text-[10px] font-medium px-1.5 py-0.5 rounded`}>
                {item.table_name}
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {ageMin > 0 ? `${ageMin}m ${ageSec}s` : `${ageSec}s`}
          </div>
        </div>

        {/* Product name + quantity */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 text-sm leading-tight">{item.product_name}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {item.waiter_name ? `👤 ${item.waiter_name}` : '—'}
            </div>
          </div>
          <div className="flex-shrink-0">
            <div className={`inline-flex items-center justify-center min-w-[2rem] h-7 px-2 ${accent.headerBg} text-white font-bold rounded text-sm`}>
              ×{Number(item.quantity)}
            </div>
          </div>
        </div>

        {/* Notes */}
        {item.notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mb-2">
            <div className="text-[10px] text-yellow-700 font-medium uppercase">Izoh</div>
            <div className="text-xs text-yellow-900">{item.notes}</div>
          </div>
        )}

        {/* Chef info (if assigned) */}
        {item.chef_name && item.status === 'cooking' && (
          <div className="text-[10px] text-slate-500 mb-2 flex items-center gap-1">
            <ChefHat className="h-3 w-3" />
            {item.chef_name}
          </div>
        )}

        {/* Actions */}
        {showCancelDialog ? (
          <div className="bg-red-50 rounded p-1.5 space-y-1.5">
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Sababni kiriting..."
              className="w-full h-7 px-2 text-xs border border-red-300 rounded"
              autoFocus
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setShowCancelDialog(false); setReason(''); }}
                disabled={updating}
                className="h-7 text-[11px] flex-1"
              >
                Yo&apos;q
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (reason.trim()) {
                    onCancel(reason.trim());
                    setShowCancelDialog(false);
                    setReason('');
                  }
                }}
                disabled={!reason.trim() || updating}
                className="h-7 text-[11px] flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Bekor
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-1.5">
            {actions.map(a => (
              <Button
                key={a.status}
                size="sm"
                onClick={() => onAction(a.status)}
                disabled={updating}
                className={`h-8 text-xs flex-1 ${variantStyles[a.variant]}`}
              >
                {a.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCancelDialog(true)}
              disabled={updating}
              className="h-8 px-2 text-red-600 hover:bg-red-50"
              aria-label="Bekor qilish"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CancelledItemCard({ item }: { item: StationQueueItem }) {
  return (
    <div className="bg-red-50 rounded-lg border border-red-200 p-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-slate-900 text-xs">#{item.order_number}</span>
        {item.table_name && (
          <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded">
            {item.table_name}
          </span>
        )}
      </div>
      <div className="font-semibold text-slate-900 text-sm line-through">{item.product_name}</div>
      <div className="text-xs text-slate-500 mt-0.5">×{Number(item.quantity)}</div>
      {item.cancel_reason && (
        <div className="text-[10px] text-red-700 mt-1 bg-red-100 px-1.5 py-0.5 rounded">
          {item.cancel_reason}
        </div>
      )}
    </div>
  );
}
