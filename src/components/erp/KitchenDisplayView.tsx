'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatDateTime } from './utils'

type KitchenOrder = {
  id: string
  invoiceNo: string
  kitchenStatus: string
  kitchenStartedAt: string | null
  kitchenReadyAt: string | null
  createdAt: string
  table: { name: string }
  waiter: { name: string }
  items: { id: string; quantity: number; notes: string | null; product: { name: string } }[]
}

export default function KitchenDisplayView() {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'new' | 'cooking' | 'ready' | 'all'>('active')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(`/api/kitchen/orders?status=${filter}`)
      setOrders(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Auto-refresh every 10 seconds
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [filter])

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await api(`/api/kitchen/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ kitchenStatus: status })
      })
      toast.success(status === 'cooking' ? 'Tayyorlanmoqda...' : status === 'ready' ? 'Tayyor! ✓' : 'Berildi')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const formatDuration = (start: string, end?: string | null) => {
    const startTime = new Date(start).getTime()
    const endTime = end ? new Date(end).getTime() : Date.now()
    const minutes = Math.floor((endTime - startTime) / 60000)
    const seconds = Math.floor((endTime - startTime) / 1000) % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🍳 Oshpaz ekrani (KDS)</h2>
          <p className="text-slate-500 text-sm">Har 10 soniyada avtomatik yangilanadi • {orders.length} ta buyurtma</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {[
            { v: 'active', l: 'Aktiv' },
            { v: 'new', l: 'Yangi' },
            { v: 'cooking', l: 'Tayyorlanmoqda' },
            { v: 'ready', l: 'Tayyor' },
            { v: 'all', l: 'Hammasi' }
          ].map(f => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v as any)}
              className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap ${filter === f.v ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🍳</div>
          Buyurtmalar yo'q. Oshpazlar dam olishmoqda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map(order => {
            const statusColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
              new: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', label: '🆕 Yangi' },
              cooking: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', label: '🔥 Tayyorlanmoqda' },
              ready: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', label: '✓ Tayyor' },
              served: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600', label: '✓ Berildi' }
            }
            const sc = statusColors[order.kitchenStatus] || statusColors.new

            return (
              <div key={order.id} className={`bg-white rounded-2xl border-2 ${sc.border} overflow-hidden`}>
                <div className={`p-3 ${sc.bg} flex items-center justify-between`}>
                  <div>
                    <div className="font-bold text-slate-900">{order.table.name}</div>
                    <div className="text-xs text-slate-600">{order.waiter.name}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.text} bg-white`}>
                    {sc.label}
                  </span>
                </div>

                <div className="p-3 space-y-2">
                  {order.items.map(it => (
                    <div key={it.id} className="flex items-start gap-2">
                      <span className="font-bold text-emerald-600 text-lg">{it.quantity}×</span>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{it.product.name}</div>
                        {it.notes && <div className="text-xs text-amber-600 italic">📝 {it.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-3 pb-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{formatDateTime(order.createdAt)}</span>
                  {order.kitchenStartedAt && (
                    <span className="font-mono">
                      {order.kitchenReadyAt ? '⏱' : '⏱'} {formatDuration(order.kitchenStartedAt, order.kitchenReadyAt)}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="px-3 pb-3 flex gap-2">
                  {order.kitchenStatus === 'new' && (
                    <button
                      onClick={() => updateStatus(order.id, 'cooking')}
                      className="flex-1 py-2 rounded-lg bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600"
                    >
                      🔥 Tayyorlashni boshlash
                    </button>
                  )}
                  {order.kitchenStatus === 'cooking' && (
                    <button
                      onClick={() => updateStatus(order.id, 'ready')}
                      className="flex-1 py-2 rounded-lg bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600"
                    >
                      ✓ Tayyor
                    </button>
                  )}
                  {order.kitchenStatus === 'ready' && (
                    <button
                      onClick={() => updateStatus(order.id, 'served')}
                      className="flex-1 py-2 rounded-lg bg-slate-500 text-white font-semibold text-sm hover:bg-slate-600"
                    >
                      ✓ Berildi
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
