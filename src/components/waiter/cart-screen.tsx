'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cart-context';
import { apiData, ApiError } from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, ArrowLeft, Trash2, Minus, Plus, Send, ShoppingCart, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Order } from '@/lib/types';

interface CartScreenProps {
  tableId: string;
  orderId?: string;
  onOrderCreated: (orderId: string) => void;
  onBack: () => void;
}

export function CartScreen({ tableId, orderId, onOrderCreated, onBack }: CartScreenProps) {
  const { cart, updateQuantity, removeItem, clearCart, total } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Group items by station for preview
  const byStation = cart.reduce<Record<string, typeof cart>>((acc, item) => {
    if (!acc[item.station]) acc[item.station] = [];
    acc[item.station].push(item);
    return acc;
  }, {});

  const STATION_LABELS: Record<string, string> = {
    kitchen: 'Oshxona',
    kebab: 'Kabob',
    bar: 'Bar',
    other: 'Boshqa',
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const idempotencyKey = uuidv4();

      if (orderId) {
        // Add items to existing order
        await apiData(`/api/orders/${orderId}/items`, {
          method: 'POST',
          body: JSON.stringify({
            items: cart.map(i => ({
              productId: i.productId,
              name: i.name,
              unitPrice: i.unitPrice,
              costPrice: i.costPrice,
              quantity: i.quantity,
              notes: i.notes ?? null,
              station: i.station,
              variantId: i.variantId ?? null,
            })),
          }),
        });
        // Send to stations (non-blocking — print jobs queue will retry)
        await apiData(`/api/orders/${orderId}/send`, { method: 'POST' }).catch(() => {});

        toast.success('Buyurtma yuborildi', {
          description: "Oshxona va kabob bo'limiga yuborildi",
        });
        clearCart();
        onOrderCreated(orderId);
      } else {
        // Create new order with items (atomic transaction)
        const orderRes = await apiData<Order>('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            tableId,
            orderType: 'dine_in',
            items: cart.map(i => ({
              productId: i.productId,
              name: i.name,
              unitPrice: i.unitPrice,
              costPrice: i.costPrice,
              quantity: i.quantity,
              notes: i.notes ?? null,
              station: i.station,
              variantId: i.variantId ?? null,
            })),
            idempotencyKey,
          }),
        });

        // Send to stations (atomic — creates print jobs)
        await apiData(`/api/orders/${orderRes.id}/send`, { method: 'POST' }).catch(() => {});

        toast.success('Buyurtma yaratildi', {
          description: `Order #${orderRes.order_number} oshxonaga yuborildi`,
        });
        clearCart();
        onOrderCreated(orderRes.id);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(
        apiErr.code === 'CONFLICT'
          ? 'Stol band qilingan yoki buyurtma o\'zgartirilgan. Yangilab qayta urining.'
          : apiErr.code === 'IDEMPOTENT_REPLAY'
          ? 'Bu buyurtma allaqachon yuborilgan'
          : (apiErr.message ?? 'Buyurtma yaratilmadi'),
      );
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Menyuga qaytish
        </Button>
        <div className="text-center py-16">
          <ShoppingCart className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Savat bo'sh</h2>
          <p className="text-sm text-slate-500">Mahsulot qo'shing va qaytib keling</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-32">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600 mb-3">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Menyuga qaytish
      </Button>

      <h2 className="text-lg font-bold text-slate-900 mb-3">Savat</h2>

      {/* Items grouped by station */}
      <div className="space-y-3 mb-4">
        {Object.entries(byStation).map(([station, items]) => (
          <div key={station} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                {STATION_LABELS[station] ?? station}
              </span>
              <span className="text-xs text-slate-500">{items.length} ta</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map(item => (
                <li key={item.productId} className="px-3 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm truncate">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.unitPrice.toLocaleString('uz-UZ')} so'm</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center active:scale-95"
                      aria-label="Kamaytirish"
                    >
                      <Minus className="h-3.5 w-3.5 text-slate-700" />
                    </button>
                    <span className="w-8 text-center font-semibold text-slate-900 text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center active:scale-95"
                      aria-label="Ko'paytirish"
                    >
                      <Plus className="h-3.5 w-3.5 text-slate-700" />
                    </button>
                  </div>
                  <div className="w-20 text-right">
                    <div className="font-bold text-slate-900 text-sm">{(item.unitPrice * item.quantity).toLocaleString('uz-UZ')}</div>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="w-7 h-7 rounded-md text-red-500 hover:bg-red-50 flex items-center justify-center"
                    aria-label="O'chirish"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-emerald-800 font-medium">Jami:</span>
          <span className="text-2xl font-bold text-emerald-700">{total.toLocaleString('uz-UZ')} so'm</span>
        </div>
      </div>

      {/* Print info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-4 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700">
          <strong>Print qilish:</strong> Buyurtma yuborilgandan keyin avtomatik ravishda oshxona va kabob printerlariga jo'natiladi. Agar printer ishlamasa, buyurtma bazada saqlanib qoladi va qayta urinib ko'riladi.
        </div>
      </div>

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-white via-white to-transparent">
        <div className="max-w-3xl mx-auto">
          {showConfirm ? (
            <div className="bg-white border border-emerald-200 rounded-xl p-3 shadow-lg">
              <div className="text-center mb-2">
                <div className="font-semibold text-slate-900 text-sm">Buyurtmani tasdiqlaysizmi?</div>
                <div className="text-xs text-slate-500">
                  {cart.length} ta mahsulot · {total.toLocaleString('uz-UZ')} so'm
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  disabled={submitting}
                  className="flex-1 h-12"
                >
                  Bekor
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Tasdiqlash'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowConfirm(true)}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
            >
              <Send className="h-5 w-5 mr-2" />
              {orderId ? 'Buyurtmaga qo\'shish' : 'Buyurtma yuborish'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
