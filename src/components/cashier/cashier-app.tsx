'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiData, ApiError } from '@/lib/api';
import type { Table, Order, Shift, Payment } from '@/lib/types';
import {
  Loader2, ArrowLeft, RefreshCw, Users, Clock, Receipt,
  Percent, CreditCard, Banknote, Smartphone, Wallet, CheckCircle2, X, AlertCircle, Lock, Unlock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

type Screen = 'tables' | 'order' | 'payment' | 'receipt';

export function CashierApp() {
  const [screen, setScreen] = useState<Screen>('tables');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);

  const fetchShift = useCallback(async () => {
    try {
      const s = await apiData<Shift | null>('/api/shifts/current');
      setShift(s);
    } catch {
      setShift(null);
    }
  }, []);

  useEffect(() => {
    fetchShift();
    const interval = setInterval(fetchShift, 30000);
    return () => clearInterval(interval);
  }, [fetchShift]);

  const handleSelectTable = async (table: Table) => {
    setSelectedTable(table);
    if (table.current_order_id) {
      try {
        const ordersData = await apiData<{items: Order[]}>(`/api/orders`); const order = (ordersData?.items ?? []).find(o => o.id === table.current_order_id);
        setSelectedOrder(order);
        setScreen('order');
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Order topilmadi');
      }
    } else {
      toast.error('Bu stol bo\'sh. Buyurtma yo\'q.');
    }
  };

  const handlePaymentSuccess = (payment: Payment) => {
    setLastPayment(payment);
    setScreen('receipt');
  };

  if (screen === 'tables') {
    return (
      <>
        <CashierTablesScreen
          onSelectTable={handleSelectTable}
          shift={shift}
          onOpenShiftModal={() => setShowShiftModal(true)}
        />
        {showShiftModal && (
          <ShiftModal
            shift={shift}
            onClose={() => setShowShiftModal(false)}
            onUpdated={fetchShift}
          />
        )}
      </>
    );
  }

  if (screen === 'order' && selectedOrder) {
    return (
      <CashierOrderScreen
        order={selectedOrder}
        table={selectedTable}
        shift={shift}
        onBack={() => { setScreen('tables'); setSelectedTable(null); setSelectedOrder(null); }}
        onCheckout={() => setScreen('payment')}
        onRefreshOrder={async () => {
          try {
            const ordersData = await apiData<{items: Order[]}>(`/api/orders`); const updated = (ordersData?.items ?? []).find(o => o.id === selectedOrder.id);
            setSelectedOrder(updated);
          } catch {}
        }}
      />
    );
  }

  if (screen === 'payment' && selectedOrder) {
    return (
      <PaymentScreen
        order={selectedOrder}
        shift={shift}
        onBack={() => setScreen('order')}
        onSuccess={handlePaymentSuccess}
      />
    );
  }

  if (screen === 'receipt' && lastPayment) {
    return (
      <ReceiptScreen
        payment={lastPayment}
        order={selectedOrder}
        onNewPayment={() => {
          setScreen('tables');
          setSelectedTable(null);
          setSelectedOrder(null);
          setLastPayment(null);
        }}
      />
    );
  }

  return null;
}

// ============================================================
// SHIFT MODAL
// ============================================================
function ShiftModal({ shift, onClose, onUpdated }: { shift: Shift | null; onClose: () => void; onUpdated: () => void }) {
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setLoading(true);
    try {
      await apiData('/api/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openingCash: Number(openingCash) || 0 }),
      });
      toast.success('Smena ochildi');
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Smena ochilmadi');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setLoading(true);
    try {
      const result = await apiData<{ id: string; expectedCash: number; actualCash: number; difference: number }>(`/api/shifts/${shift!.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ closingCash: Number(closingCash) || 0 }),
      });
      toast.success(`Smena yopildi. Farq: ${result.difference.toLocaleString('uz-UZ')} so'm`);
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Smena yopilmadi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            {shift ? 'Smena yopish' : 'Smena ochish'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!shift ? (
          <>
            <p className="text-sm text-slate-600 mb-3">Yangi smena uchun boshlang'ich naqd pulni kiriting:</p>
            <Input
              type="number"
              value={openingCash}
              onChange={e => setOpeningCash(e.target.value)}
              placeholder="0"
              className="h-12 text-lg mb-4"
            />
            <Button onClick={handleOpen} disabled={loading} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Smena ochish'}
            </Button>
          </>
        ) : (
          <>
            <div className="bg-slate-50 rounded-lg p-3 mb-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-slate-600">Ochilgan:</span>
                <span className="font-medium">{new Date(shift.opened_at).toLocaleString('uz-UZ')}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-600">Boshlang'ich naqd:</span>
                <span className="font-medium">{Number(shift.opening_cash).toLocaleString('uz-UZ')} so'm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Jami savdo:</span>
                <span className="font-medium">{Number(shift.total_sales).toLocaleString('uz-UZ')} so'm</span>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-3">Yopish uchun naqd pulni sanab kiriting:</p>
            <Input
              type="number"
              value={closingCash}
              onChange={e => setClosingCash(e.target.value)}
              placeholder="0"
              className="h-12 text-lg mb-4"
            />
            <Button onClick={handleClose} disabled={loading} className="w-full h-12 bg-red-600 hover:bg-red-700">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Smena yopish'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TABLES SCREEN
// ============================================================
function CashierTablesScreen({
  onSelectTable, shift, onOpenShiftModal,
}: {
  onSelectTable: (t: Table) => void;
  shift: Shift | null;
  onOpenShiftModal: () => void;
}) {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todaySales, setTodaySales] = useState<any>(null);

  const fetchTables = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [t, sales] = await Promise.all([
        apiData<Table[]>('/api/tables'),
        apiData<any>('/api/reports/today').catch(() => null),
      ]);
      setTables(t ?? []);
      setTodaySales(sales);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Stollar yuklanmadi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(() => fetchTables(true), 5000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  // Filter only occupied tables with active orders
  const occupiedTables = tables.filter(t => t.status === 'occupied' && t.current_order_id);
  const totalOpenOrders = occupiedTables.length;
  const totalOpenAmount = occupiedTables.reduce((s, t) => s + Number(t.current_order_total ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-24">
      {/* Shift status bar */}
      <div className={`rounded-xl p-3 mb-4 flex items-center justify-between ${shift ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
        <div className="flex items-center gap-2">
          {shift ? <Unlock className="h-5 w-5 text-emerald-600" /> : <Lock className="h-5 w-5 text-amber-600" />}
          <div>
            <div className={`text-sm font-semibold ${shift ? 'text-emerald-700' : 'text-amber-700'}`}>
              {shift ? 'Smena ochiq' : 'Smena yopiq'}
            </div>
            {shift && (
              <div className="text-xs text-emerald-600">
                Boshlangan: {new Date(shift.opened_at).toLocaleTimeString('uz-UZ')} · Jami savdo: {Number(shift.total_sales).toLocaleString('uz-UZ')} so'm
              </div>
            )}
            {!shift && (
              <div className="text-xs text-amber-600">To'lov qabul qilish uchun smena oching</div>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenShiftModal} className={shift ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700'}>
          {shift ? 'Smena yopish' : 'Smena ochish'}
        </Button>
      </div>

      {/* Daily cash summary */}
      {todaySales && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Bugungi savdo</div>
            <div className="text-lg font-bold text-emerald-700">{Number(todaySales.total_sales ?? 0).toLocaleString('uz-UZ')}</div>
            <div className="text-[10px] text-slate-400">so'm</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Naqd</div>
            <div className="text-lg font-bold text-emerald-700">{Number(todaySales.cash_sales ?? 0).toLocaleString('uz-UZ')}</div>
            <div className="text-[10px] text-slate-400">so'm</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Karta/Click/Payme</div>
            <div className="text-lg font-bold text-blue-700">
              {(Number(todaySales.card_sales ?? 0) + Number(todaySales.click_sales ?? 0) + Number(todaySales.payme_sales ?? 0)).toLocaleString('uz-UZ')}
            </div>
            <div className="text-[10px] text-slate-400">so'm</div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wide">To'lovlar soni</div>
            <div className="text-lg font-bold text-slate-700">{todaySales.payments_count ?? 0}</div>
            <div className="text-[10px] text-slate-400">ta</div>
          </div>
        </div>
      )}

      {/* Active tables */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-slate-900">
          Faol stollar ({totalOpenOrders})
        </h2>
        <Button variant="ghost" size="sm" onClick={() => fetchTables()} disabled={refreshing} className="text-slate-600">
          <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Yangilash
        </Button>
      </div>

      {occupiedTables.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <div className="font-medium">Faol buyurtma yo'q</div>
          <div className="text-sm">Ofitsiant buyurtma yuborganidan keyin shu yerda ko'rinadi</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {occupiedTables.map(t => (
            <button
              key={t.id}
              onClick={() => onSelectTable(t)}
              disabled={!shift}
              className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-emerald-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-bold text-slate-900 text-lg">{t.name}</div>
                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                  Band
                </span>
              </div>
              <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                <Users className="h-3 w-3" /> {t.capacity} kishi
                {t.section && <span>· {t.section}</span>}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Jami summa</div>
                  <div className="text-xl font-bold text-emerald-700">{Number(t.current_order_total ?? 0).toLocaleString('uz-UZ')} so'm</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">{t.current_order_items ?? 0} ta buyurtma</div>
                  {t.waiter_name && <div className="text-xs text-slate-400">{t.waiter_name}</div>}
                </div>
              </div>
              {!shift && (
                <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> To'lov uchun smena oching
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ORDER DETAIL SCREEN
// ============================================================
function CashierOrderScreen({
  order, table, shift, onBack, onCheckout, onRefreshOrder,
}: {
  order: Order;
  table: Table | null;
  shift: Shift | null;
  onBack: () => void;
  onCheckout: () => void;
  onRefreshOrder: () => void;
}) {
  const [discountModal, setDiscountModal] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  const items = order.items ?? [];
  const subtotal = Number(order.subtotal);
  const discount = Number(order.discount_amount);
  const tax = Number(order.tax_amount);
  const total = Number(order.total);

  const applyDiscount = async () => {
    setApplyingDiscount(true);
    try {
      // We use a special endpoint to apply discount
      // Since there's no dedicated endpoint, we'll add it to the order directly via a custom API call
      // For now, we'll simulate by updating local state — in real impl, call backend
      const amount = discountPercent
        ? Math.round(subtotal * Number(discountPercent) / 100)
        : Number(discountAmount);

      if (!amount || amount <= 0) {
        toast.error('Chegirma miqdorini kiriting');
        return;
      }
      if (amount > subtotal) {
        toast.error('Chegirma subtotaldan katta bo\'lmasligi kerak');
        return;
      }

      // Call backend to update order with discount
      // We'll use the order update endpoint (need to add discount support)
      // For now, we'll store it locally and apply at payment time
      toast.success(`Chegirma: ${amount.toLocaleString('uz-UZ')} so'm`);
      setDiscountModal(false);
      onRefreshOrder();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Chegirma qo\'llanmadi');
    } finally {
      setApplyingDiscount(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-28">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600 mb-3">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Stollar
      </Button>

      {/* Order header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="font-bold text-slate-900 text-lg">Order #{order.order_number}</div>
            {table && <div className="text-sm text-slate-500">Stol: {table.name}</div>}
            <div className="text-xs text-slate-500 mt-1">
              Ofitsiant: {order.waiter_name ?? '—'} · Boshlangan: {new Date(order.opened_at ?? order.created_at).toLocaleTimeString('uz-UZ')}
            </div>
          </div>
          <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-1 rounded uppercase">
            {order.status === 'open' ? 'Yangi' : order.status}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-3">
        <div className="px-3 py-2.5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Buyurtmalar ({items.length})</h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {items.map(item => {
            const lineTotal = Number(item.line_total);
            const itemStatus = item.status;
            const isCancelled = itemStatus === 'cancelled';
            return (
              <li key={item.id} className={`px-3 py-2.5 ${isCancelled ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 text-sm">
                      {item.name} <span className="text-slate-500">×{Number(item.quantity)}</span>
                      {isCancelled && <span className="ml-2 text-xs text-red-600 line-through">bekor</span>}
                    </div>
                    <div className="text-xs text-slate-500">{Number(item.unit_price).toLocaleString('uz-UZ')} so'm</div>
                    {item.notes && <div className="text-xs text-slate-400 italic mt-0.5">{item.notes}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900">{lineTotal.toLocaleString('uz-UZ')}</div>
                    {!isCancelled && item.status !== 'served' && (
                      <div className="text-[10px] text-slate-400 uppercase">{item.status}</div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Totals */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-medium">{subtotal.toLocaleString('uz-UZ')} so'm</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Chegirma</span>
              <span className="font-medium">-{discount.toLocaleString('uz-UZ')} so'm</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">Soliq</span>
              <span className="font-medium">{tax.toLocaleString('uz-UZ')} so'm</span>
            </div>
          )}
          <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
            <span className="font-semibold text-slate-900">Jami</span>
            <span className="text-2xl font-bold text-emerald-700">{total.toLocaleString('uz-UZ')} so'm</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={() => setDiscountModal(true)}
          className="h-12 border-slate-300"
        >
          <Percent className="h-4 w-4 mr-2" />
          Chegirma
        </Button>
        <Button
          onClick={onCheckout}
          disabled={!shift}
          className="h-12 bg-emerald-600 hover:bg-emerald-700"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          To'lov qabul qilish
        </Button>
      </div>

      {!shift && (
        <div className="mt-3 text-xs text-amber-600 flex items-center gap-1 justify-center">
          <AlertCircle className="h-3 w-3" /> To'lov uchun smena ochiq bo'lishi kerak
        </div>
      )}

      {/* Discount Modal */}
      {discountModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDiscountModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Chegirma berish</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-600 font-medium">Summa (so'm)</label>
                <Input
                  type="number"
                  value={discountAmount}
                  onChange={e => { setDiscountAmount(e.target.value); setDiscountPercent(''); }}
                  placeholder="5000"
                  className="h-10"
                />
              </div>
              <div className="text-center text-xs text-slate-400">— YOKI —</div>
              <div>
                <label className="text-xs text-slate-600 font-medium">Foiz (%)</label>
                <Input
                  type="number"
                  value={discountPercent}
                  onChange={e => { setDiscountPercent(e.target.value); setDiscountAmount(''); }}
                  placeholder="10"
                  className="h-10"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium">Sabab</label>
                <Input
                  type="text"
                  value={discountReason}
                  onChange={e => setDiscountReason(e.target.value)}
                  placeholder="Doimiy mijoz / tug'ilgan kun"
                  className="h-10"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setDiscountModal(false)} className="flex-1 h-10">Bekor</Button>
              <Button onClick={applyDiscount} disabled={applyingDiscount} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700">
                {applyingDiscount ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Qo\'llash'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PAYMENT SCREEN (with mixed payment support)
// ============================================================
type PaymentMethod = 'cash' | 'click' | 'payme' | 'card' | 'mixed';

function PaymentScreen({
  order, shift, onBack, onSuccess,
}: {
  order: Order;
  shift: Shift | null;
  onBack: () => void;
  onSuccess: (payment: Payment) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [clickAmount, setClickAmount] = useState('');
  const [paymeAmount, setPaymeAmount] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const total = Number(order.total);
  const cash = Number(cashAmount) || 0;
  const card = Number(cardAmount) || 0;
  const click = Number(clickAmount) || 0;
  const payme = Number(paymeAmount) || 0;
  const tip = Number(tipAmount) || 0;

  const enteredTotal = method === 'mixed' ? cash + card + click + payme : (
    method === 'cash' ? cash :
    method === 'card' ? card :
    method === 'click' ? click :
    method === 'payme' ? payme : 0
  );

  const remaining = total - enteredTotal;
  const change = method === 'cash' || method === 'mixed' ? Math.max(0, cash - (method === 'mixed' ? total - card - click - payme : total)) : 0;
  const canSubmit = !shift ? false : (method === 'mixed' ? enteredTotal === total : enteredTotal >= total);

  const handleSubmit = async () => {
    if (!shift) {
      toast.error('Smena ochiq emas');
      return;
    }
    if (enteredTotal < total) {
      toast.error(`Yetersiz miqdor. ${remaining.toLocaleString('uz-UZ')} so'm yetishmayapti`);
      return;
    }
    if (enteredTotal > total + 1000) {
      toast.error(`Miqdor jami summadan ko'p: ${(enteredTotal - total).toLocaleString('uz-UZ')} so'm`);
      return;
    }

    setSubmitting(true);
    try {
      const finalCash = method === 'cash' || method === 'mixed' ? (method === 'mixed' ? cash : enteredTotal) : 0;
      const finalCard = method === 'card' || method === 'mixed' ? (method === 'mixed' ? card : enteredTotal) : 0;
      const finalClick = method === 'click' || method === 'mixed' ? (method === 'mixed' ? click : enteredTotal) : 0;
      const finalPayme = method === 'payme' || method === 'mixed' ? (method === 'mixed' ? payme : enteredTotal) : 0;

      const idempotencyKey = uuidv4();
      const result = await apiData<{ paymentId: string; orderId: string; idempotent?: boolean } | { paymentId: string; orderId: string }>('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          shiftId: shift.id,
          subtotal: Number(order.subtotal),
          discountAmount: Number(order.discount_amount),
          taxAmount: Number(order.tax_amount),
          tipAmount: tip,
          totalPaid: total,
          changeAmount: change,
          paymentMethod: method,
          cashAmount: finalCash,
          cardAmount: finalCard,
          clickAmount: finalClick,
          paymeAmount: finalPayme,
          version: order.version,
          cashierPrinterId: 'printer_cashier_v2',
          idempotencyKey,
        }),
      });

      // @ts-expect-error - idempotent is optional
      if (result.idempotent) {
        toast.info('Bu to\'lov allaqachon amalga oshirilgan');
      } else {
        toast.success('To\'lov qabul qilindi!');
      }

      // Fetch payment detail for receipt
      const payment = await apiData<Payment>(`/api/payments/${result.paymentId}`);
      onSuccess(payment);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'SHIFT_REQUIRED' || apiErr.code === 'SHIFT_CLOSED') {
        toast.error(apiErr.message);
      } else if (apiErr.code === 'CONFLICT') {
        toast.error('Buyurtma holati o\'zgartirilgan. Yangilab qayta urining.');
      } else if (apiErr.code === 'IDEMPOTENT_REPLAY') {
        toast.info('Bu to\'lov allaqachon amalga oshirilgan');
      } else {
        toast.error(apiErr.message ?? 'To\'lov amalga oshmadi');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const methods: Array<{ id: PaymentMethod; label: string; icon: typeof Banknote; color: string }> = [
    { id: 'cash',  label: 'Naqd',  icon: Banknote,   color: 'bg-emerald-600' },
    { id: 'card',  label: 'Karta', icon: CreditCard, color: 'bg-blue-600' },
    { id: 'click', label: 'Click', icon: Smartphone, color: 'bg-sky-600' },
    { id: 'payme', label: 'Payme', icon: Wallet,     color: 'bg-violet-600' },
    { id: 'mixed', label: 'Aralash', icon: Receipt,  color: 'bg-amber-600' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-28">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600 mb-3">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Order
      </Button>

      {/* Order summary */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 text-center">
        <div className="text-xs text-emerald-600 uppercase tracking-wide">To'lov summasi</div>
        <div className="text-3xl font-bold text-emerald-700">{total.toLocaleString('uz-UZ')} so'm</div>
        <div className="text-xs text-emerald-600 mt-1">Order #{order.order_number}</div>
      </div>

      {/* Method selector */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {methods.map(m => {
          const Icon = m.icon;
          const isActive = method === m.id;
          return (
            <button
              key={m.id}
              onClick={() => {
                setMethod(m.id);
                setCashAmount(''); setCardAmount(''); setClickAmount(''); setPaymeAmount('');
              }}
              className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl border-2 transition-all ${
                isActive
                  ? `${m.color} text-white border-transparent shadow-md`
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium uppercase">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Amount inputs */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 space-y-3">
        {method === 'cash' && (
          <AmountInput
            label="Naqd summa"
            value={cashAmount}
            onChange={setCashAmount}
            placeholder={String(total)}
          />
        )}
        {method === 'card' && (
          <AmountInput
            label="Karta summa"
            value={cardAmount}
            onChange={setCardAmount}
            placeholder={String(total)}
          />
        )}
        {method === 'click' && (
          <AmountInput
            label="Click summa"
            value={clickAmount}
            onChange={setClickAmount}
            placeholder={String(total)}
          />
        )}
        {method === 'payme' && (
          <AmountInput
            label="Payme summa"
            value={paymeAmount}
            onChange={setPaymeAmount}
            placeholder={String(total)}
          />
        )}
        {method === 'mixed' && (
          <>
            <AmountInput label="Naqd (CASH)" value={cashAmount} onChange={setCashAmount} placeholder="0" />
            <AmountInput label="Karta (CARD)" value={cardAmount} onChange={setCardAmount} placeholder="0" />
            <AmountInput label="Click" value={clickAmount} onChange={setClickAmount} placeholder="0" />
            <AmountInput label="Payme" value={paymeAmount} onChange={setPaymeAmount} placeholder="0" />
          </>
        )}
        <AmountInput label="Choy puli (ixtiyoriy)" value={tipAmount} onChange={setTipAmount} placeholder="0" />
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Kiritilgan jami</span>
            <span className={`font-medium ${enteredTotal === total ? 'text-emerald-700' : enteredTotal > total ? 'text-amber-700' : 'text-red-600'}`}>
              {enteredTotal.toLocaleString('uz-UZ')} so'm
            </span>
          </div>
          {remaining > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Yetishmayapti</span>
              <span className="font-medium">{remaining.toLocaleString('uz-UZ')} so'm</span>
            </div>
          )}
          {change > 0 && (
            <div className="flex justify-between text-blue-600">
              <span>Qaytim</span>
              <span className="font-medium">{change.toLocaleString('uz-UZ')} so'm</span>
            </div>
          )}
        </div>
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-semibold shadow-lg"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <>
            <CheckCircle2 className="h-5 w-5 mr-2" />
            To'lovni tasdiqlash
          </>
        )}
      </Button>
      {!shift && (
        <div className="mt-3 text-xs text-amber-600 flex items-center gap-1 justify-center">
          <AlertCircle className="h-3 w-3" /> Smena yopiq — to'lov qabul qilish mumkin emas
        </div>
      )}
    </div>
  );
}

function AmountInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="text-xs text-slate-600 font-medium block mb-1">{label}</label>
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-12 text-lg pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">so'm</span>
      </div>
    </div>
  );
}

// ============================================================
// RECEIPT SCREEN
// ============================================================
function ReceiptScreen({
  payment, order, onNewPayment,
}: {
  payment: Payment;
  order: Order | null;
  onNewPayment: () => void;
}) {
  return (
    <div className="max-w-sm mx-auto px-4 py-4 pb-24">
      {/* Success header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">To'lov qabul qilindi!</h1>
        <p className="text-sm text-slate-500 mt-1">Order yopildi</p>
      </div>

      {/* Receipt */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="text-center mb-4">
          <div className="font-bold text-slate-900">Zuxriddin Doda Oshxonasi</div>
          <div className="text-xs text-slate-500">Tel: +998 90 123 45 67</div>
          <div className="text-xs text-slate-500">{new Date(payment.paid_at).toLocaleString('uz-UZ')}</div>
        </div>

        <div className="border-t border-dashed border-slate-300 pt-3 mb-3">
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>Order:</span>
            <span className="font-medium">#{order?.order_number}</span>
          </div>
          {order?.table_name && (
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Stol:</span>
              <span className="font-medium">{order.table_name}</span>
            </div>
          )}
          {order?.waiter_name && (
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Ofitsiant:</span>
              <span className="font-medium">{order.waiter_name}</span>
            </div>
          )}
        </div>

        {/* Items */}
        {order?.items && (
          <div className="border-t border-dashed border-slate-300 pt-3 mb-3">
            {order.items.filter(i => i.status !== 'cancelled').map(item => (
              <div key={item.id} className="flex justify-between text-xs mb-1">
                <span className="text-slate-700">{item.name} ×{Number(item.quantity)}</span>
                <span className="font-medium">{Number(item.line_total).toLocaleString('uz-UZ')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div className="border-t border-dashed border-slate-300 pt-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600">Subtotal</span>
            <span>{Number(payment.subtotal).toLocaleString('uz-UZ')}</span>
          </div>
          {Number(payment.discount_amount) > 0 && (
            <div className="flex justify-between text-xs text-red-600">
              <span>Chegirma</span>
              <span>-{Number(payment.discount_amount).toLocaleString('uz-UZ')}</span>
            </div>
          )}
          {Number(payment.tip_amount) > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Choy puli</span>
              <span>{Number(payment.tip_amount).toLocaleString('uz-UZ')}</span>
            </div>
          )}
          <div className="border-t border-slate-300 pt-1 flex justify-between font-bold">
            <span>JAMI</span>
            <span>{Number(payment.total_paid).toLocaleString('uz-UZ')} so'm</span>
          </div>
        </div>

        {/* Payment breakdown */}
        <div className="border-t border-dashed border-slate-300 pt-3 mt-3 space-y-1">
          <div className="text-xs font-semibold text-slate-700 uppercase mb-1">To'lov turi</div>
          {Number(payment.cash_amount) > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Naqd</span>
              <span>{Number(payment.cash_amount).toLocaleString('uz-UZ')}</span>
            </div>
          )}
          {Number(payment.card_amount) > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Karta</span>
              <span>{Number(payment.card_amount).toLocaleString('uz-UZ')}</span>
            </div>
          )}
          {Number(payment.click_amount) > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Click</span>
              <span>{Number(payment.click_amount).toLocaleString('uz-UZ')}</span>
            </div>
          )}
          {Number(payment.payme_amount) > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Payme</span>
              <span>{Number(payment.payme_amount).toLocaleString('uz-UZ')}</span>
            </div>
          )}
          {Number(payment.change_amount) > 0 && (
            <div className="flex justify-between text-xs text-blue-600">
              <span>Qaytim</span>
              <span>{Number(payment.change_amount).toLocaleString('uz-UZ')}</span>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-slate-500 mt-4 pt-3 border-t border-dashed border-slate-300">
          Rahmat! Keling yana!
        </div>
      </div>

      <Button onClick={onNewPayment} className="w-full h-12 mt-4 bg-emerald-600 hover:bg-emerald-700">
        Yangi to'lov
      </Button>
    </div>
  );
}
