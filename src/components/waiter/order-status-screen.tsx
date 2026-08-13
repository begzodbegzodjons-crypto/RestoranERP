'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiData, ApiError } from '@/lib/api';
import type { Order, OrderItem } from '@/lib/types';
import { Loader2, ArrowLeft, Clock, ChefHat, CheckCircle2, Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface OrderStatusScreenProps {
  orderId: string;
  onBack: () => void;
}

const STATUS_FLOW = ['pending', 'cooking', 'ready', 'served'] as const;

const STATUS_LABELS: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending:   { label: 'Kutilmoqda', icon: Clock, color: 'text-slate-500 bg-slate-100' },
  cooking:   { label: 'Tayyorlanmoqda', icon: ChefHat, color: 'text-amber-700 bg-amber-100' },
  ready:     { label: 'Tayyor', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-100' },
  served:    { label: 'Berildi', icon: Package, color: 'text-blue-700 bg-blue-100' },
  cancelled: { label: 'Bekor', icon: X, color: 'text-red-700 bg-red-100' },
};

export function OrderStatusScreen({ orderId, onBack }: OrderStatusScreenProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await apiData<Order>(`/api/orders/${orderId}`);
      setOrder(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Buyurtma topilmadi');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // Poll every 3 seconds for real-time status
  useEffect(() => {
    const interval = setInterval(fetchOrder, 3000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Orqaga
        </Button>
        <div className="text-center py-12 text-slate-500">Buyurtma topilmadi</div>
      </div>
    );
  }

  const items: OrderItem[] = order.items ?? [];

  // Compute progress per item
  const itemProgress = items.map(item => {
    const idx = STATUS_FLOW.indexOf(item.status as typeof STATUS_FLOW[number]);
    return { item, idx: idx === -1 ? -1 : idx };
  });

  // Overall progress
  const totalItems = items.filter(i => i.status !== 'cancelled').length;
  const readyItems = items.filter(i => i.status === 'ready' || i.status === 'served').length;
  const progressPercent = totalItems === 0 ? 0 : Math.round((readyItems / totalItems) * 100);

  // Order status badge
  const orderStatus = order.status;
  const StatusIcon = orderStatus === 'paid' ? CheckCircle2 :
                     orderStatus === 'cancelled' ? X :
                     orderStatus === 'cooking' ? ChefHat :
                     Clock;

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-12">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600 mb-3">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Stollar
      </Button>

      {/* Order header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="font-bold text-slate-900 text-lg">Order #{order.order_number}</div>
            {order.table_name && (
              <div className="text-sm text-slate-500">Stol: {order.table_name}</div>
            )}
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-semibold uppercase flex items-center gap-1 ${
            orderStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
            orderStatus === 'cancelled' ? 'bg-red-100 text-red-700' :
            orderStatus === 'cooking' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-700'
          }`}>
            <StatusIcon className="h-3 w-3" />
            {orderStatus}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Ofitsiant: {order.waiter_name ?? '—'} · Boshlangan: {new Date(order.opened_at ?? order.created_at).toLocaleTimeString('uz-UZ')}
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-600">Tayyorgarlik</span>
          <span className="text-xs font-bold text-emerald-700">{progressPercent}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
          <span>{readyItems}/{totalItems} tayyor</span>
          <span>3 soniyada yangilanadi</span>
        </div>
      </div>

      {/* Items with individual status */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Buyurtmalar ({items.length})</h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {items.map(item => {
            const cfg = STATUS_LABELS[item.status] ?? STATUS_LABELS.pending;
            const Icon = cfg.icon;
            return (
              <li key={item.id} className={`px-3 py-3 ${item.status === 'cancelled' ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${cfg.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm truncate">{item.name}</div>
                    <div className="text-xs text-slate-500">{Number(item.quantity)} × {Number(item.unit_price).toLocaleString('uz-UZ')} so'm</div>
                    {item.notes && (
                      <div className="text-xs text-slate-400 italic mt-0.5">{item.notes}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-700 uppercase">{cfg.label}</div>
                    <div className="text-[10px] text-slate-400 uppercase">{item.station}</div>
                  </div>
                </div>

                {/* Progress mini-bar per item */}
                {item.status !== 'cancelled' && (
                  <div className="mt-2 flex gap-1">
                    {STATUS_FLOW.map((s, idx) => {
                      const itemIdx = STATUS_FLOW.indexOf(item.status as typeof STATUS_FLOW[number]);
                      const completed = idx <= itemIdx;
                      return (
                        <div
                          key={s}
                          className={`flex-1 h-1 rounded-full ${
                            completed
                              ? s === 'pending' ? 'bg-slate-300'
                              : s === 'cooking' ? 'bg-amber-400'
                              : s === 'ready' ? 'bg-emerald-500'
                              : 'bg-blue-500'
                              : 'bg-slate-100'
                          }`}
                        />
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Total */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-emerald-800 font-medium">Jami summa:</span>
          <span className="text-xl font-bold text-emerald-700">{Number(order.total).toLocaleString('uz-UZ')} so'm</span>
        </div>
      </div>
    </div>
  );
}
