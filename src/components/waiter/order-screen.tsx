'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiData, ApiError } from '@/lib/api';
import type { Table, Order, OrderItem } from '@/lib/types';
import { Loader2, Plus, ArrowLeft, Clock, ChefHat, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface OrderScreenProps {
  tableId: string;
  orderId?: string;
  onAddItems: () => void;
  onViewStatus: (orderId: string) => void;
  onBack: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:  { label: 'Kutilmoqda', color: 'bg-slate-100 text-slate-600', icon: Clock },
  cooking:  { label: 'Tayyorlanmoqda', color: 'bg-amber-100 text-amber-700', icon: ChefHat },
  ready:    { label: 'Tayyor', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  served:   { label: 'Berildi', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  cancelled:{ label: 'Bekor', color: 'bg-red-100 text-red-700', icon: X },
};

export function OrderScreen({ tableId, orderId: initialOrderId, onAddItems, onViewStatus, onBack }: OrderScreenProps) {
  const [table, setTable] = useState<Table | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancellingItem, setCancellingItem] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tables = await apiData<Table[]>('/api/tables');
      const found = (tables ?? []).find(t => t.id === tableId) ?? null;
      setTable(found);

      const currentOrderId = initialOrderId ?? found?.current_order_id;
      if (currentOrderId) {
        const orders = await apiData<{ items: Order[] }>('/api/orders');
        const foundOrder = (orders?.items ?? []).find(o => o.id === currentOrderId);
        if (foundOrder) {
          setOrder(foundOrder as any);
        } else {
          setOrder(null);
        }
      } else {
        setOrder(null);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Ma\'lumot yuklanmadi');
    } finally {
      setLoading(false);
    }
  }, [tableId, initialOrderId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!order) return;
    const interval = setInterval(async () => {
      try {
        const orders = await apiData<{ items: Order[] }>('/api/orders');
        const found = (orders?.items ?? []).find(o => o.id === order.id);
        if (found) setOrder(found as any);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [order?.id]);

  const cancelItem = async (itemId: string, reason: string) => {
    if (!order) return;
    setCancellingItem(itemId);
    try {
      await apiData(`/api/orders/${order.id}/items/${itemId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      toast.success('Bekor qilindi');
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Bekor qilib bo\'lmadi');
    } finally {
      setCancellingItem(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>;
  }

  const total = order ? Number(order.total) : 0;
  const items: any[] = order?.items ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-28">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
          <ArrowLeft className="h-4 w-4 mr-1" /> Stollar
        </Button>
        <div className="text-right">
          {table && <div className="font-bold text-slate-900">{table.name}</div>}
          {order && <div className="text-xs text-slate-500">Order #{order.order_number}</div>}
        </div>
      </div>

      {!order ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <Plus className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Bu stol bo'sh</h2>
          <p className="text-sm text-slate-500 mb-5">Yangi buyurtma yaratish uchun menyudan mahsulot tanlang</p>
          <Button onClick={onAddItems} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6">
            <Plus className="h-4 w-4 mr-1" /> Menyuga o'tish
          </Button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Holat</div>
                <div className="font-semibold text-slate-900">{order.status === 'open' ? 'Yangi buyurtma' : order.status}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Jami</div>
                <div className="font-bold text-emerald-700 text-lg">{total.toLocaleString('uz-UZ')} so'm</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
            <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">Buyurtmalar ({items.length})</h3>
              <Button variant="outline" size="sm" onClick={onAddItems} className="h-7 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                <Plus className="h-3 w-3 mr-1" /> Qo'shish
              </Button>
            </div>
            {items.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-slate-500">Buyurtmalar yo'q</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map(item => <OrderItemRow key={item.id} item={item} onCancel={cancelItem} cancelling={cancellingItem === item.id} />)}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => onViewStatus(order.id)} className="h-12">
              <Clock className="h-4 w-4 mr-2" /> Holatni ko'rish
            </Button>
            <Button onClick={onAddItems} className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Qo'shish
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function OrderItemRow({ item, onCancel, cancelling }: { item: any; onCancel: (id: string, reason: string) => void; cancelling: boolean }) {
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');
  const cfg = STATUS_LABELS[item.status] ?? STATUS_LABELS.pending;
  const Icon = cfg.icon;
  const lineTotal = Number(item.line_total);

  if (item.status === 'cancelled') {
    return (
      <li className="px-3 py-2.5 opacity-60">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <span className="text-sm font-medium text-slate-900 line-through">{item.name}</span>
            <span className="ml-2 text-xs text-red-600">Bekor</span>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="px-3 py-3">
      {showCancel ? (
        <div className="bg-red-50 rounded-lg p-2">
          <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Sababni kiriting" className="w-full h-9 px-2 text-sm border border-slate-300 rounded mb-2" autoFocus />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setShowCancel(false); setReason(''); }} className="h-8 text-xs flex-1">Yo'q</Button>
            <Button size="sm" onClick={() => { if (reason.trim()) { onCancel(item.id, reason.trim()); setShowCancel(false); setReason(''); } }} disabled={!reason.trim() || cancelling} className="h-8 text-xs flex-1 bg-red-600 hover:bg-red-700 text-white">Tasdiqlash</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{Number(item.unit_price).toLocaleString('uz-UZ')} so'm x {item.quantity}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-900">{lineTotal.toLocaleString('uz-UZ')}</div>
              </div>
            </div>
            {item.notes && <div className="text-xs text-slate-500 italic mt-1 bg-slate-50 px-2 py-1 rounded">{item.notes}</div>}
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1 ${cfg.color} text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide`}>
                <Icon className="h-3 w-3" /> {cfg.label}
              </span>
              <span className="text-[10px] text-slate-400 uppercase">{item.station}</span>
              {(item.status === 'pending' || item.status === 'cooking') && (
                <button onClick={() => setShowCancel(true)} className="ml-auto text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded">Bekor</button>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
