'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, formatDateTime } from './utils'

type Sale = {
  id: string
  invoiceNo: string
  subtotal: number
  discount: number
  taxAmount: number
  total: number
  profit: number
  costOfGoods: number
  paymentMethod: string
  status: string
  createdAt: string
  items: { id: string; quantity: number; unitPrice: number; total: number; product: { name: string } }[]
  table: { name: string } | null
  customer: { name: string } | null
  staff: { name: string } | null
}

export default function SalesView() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<Sale | null>(null)
  const [filter, setFilter] = useState<'all' | 'completed' | 'refunded'>('all')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/sales?limit=200')
      setSales(res.items)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? sales : sales.filter(s => s.status === filter)
  const totalRevenue = filtered.filter(s => s.status === 'completed').reduce((s, x) => s + x.total, 0)
  const totalProfit = filtered.filter(s => s.status === 'completed').reduce((s, x) => s + x.profit, 0)

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
          <h2 className="text-2xl font-bold text-slate-900">🧾 Savdo tarixi</h2>
          <p className="text-slate-500 text-sm">
            Jami: <span className="font-semibold text-emerald-600">{formatMoney(totalRevenue)}</span>
            <span className="mx-2">•</span>
            Foyda: <span className="font-semibold text-teal-600">{formatMoney(totalProfit)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'completed', 'refunded'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === f ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
            >
              {f === 'all' ? 'Hammasi' : f === 'completed' ? 'Yakunlangan' : 'Qaytarilgan'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Chek #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Sana</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Stol</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Ofitsiant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Pozitsiya</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">To'lov</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Summa</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Foyda</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Holat</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">Savdo yo'q</td></tr>
              )}
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setView(s)}>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{s.invoiceNo}</td>
                  <td className="px-4 py-3 text-slate-600 text-sm">{formatDateTime(s.createdAt)}</td>
                  <td className="px-4 py-3 text-sm">
                    {s.table ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 font-medium text-slate-700">
                        🪑 {s.table.name}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {s.staff ? (
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        👤 {s.staff.name}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-sm">{s.items.length} ta</td>
                  <td className="px-4 py-3 text-slate-600 text-sm">
                    {s.paymentMethod === 'cash' ? '💵 Naqd' : s.paymentMethod === 'card' ? '💳 Karta' : '🔄 O\'tkazma'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatMoney(s.total)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatMoney(s.profit)}</td>
                  <td className="px-4 py-3 text-center">
                    {s.status === 'completed' ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Yakunlangan</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Qaytarilgan</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {view && (
        <Modal open onClose={() => setView(null)} title={`Chek: ${view.invoiceNo}`} size="md">
          <div className="space-y-4">
            {/* Staff & Table info - prominent */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm border border-emerald-100">
              <div>
                <div className="text-emerald-700 text-xs font-semibold">🪑 Stol</div>
                <div className="font-bold text-slate-900">{view.table?.name || '—'}</div>
              </div>
              <div>
                <div className="text-emerald-700 text-xs font-semibold">👤 Ofitsiant</div>
                <div className="font-bold text-slate-900">{view.staff?.name || '—'}</div>
              </div>
              <div>
                <div className="text-emerald-700 text-xs font-semibold">💳 Kassir</div>
                <div className="font-bold text-slate-900">
                  {view.notes?.includes('Kassir:') ? view.notes.split('Kassir:')[1].trim() : '—'}
                </div>
              </div>
              <div>
                <div className="text-emerald-700 text-xs font-semibold">📅 Sana</div>
                <div className="font-bold text-slate-900">{formatDateTime(view.createdAt)}</div>
              </div>
              <div>
                <div className="text-emerald-700 text-xs font-semibold">💰 To'lov turi</div>
                <div className="font-bold text-slate-900">
                  {view.paymentMethod === 'cash' ? '💵 Naqd' : view.paymentMethod === 'card' ? '💳 Karta' : '🔄 O\'tkazma'}
                </div>
              </div>
              {view.customer && (
                <div>
                  <div className="text-emerald-700 text-xs font-semibold">👥 Mijoz</div>
                  <div className="font-bold text-slate-900">{view.customer.name}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {view.items.map(it => (
                <div key={it.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <div>
                    <div className="font-medium text-slate-900">{it.product.name}</div>
                    <div className="text-xs text-slate-500">{it.quantity} × {formatMoney(it.unitPrice)}</div>
                  </div>
                  <div className="font-bold text-slate-900">{formatMoney(it.total)}</div>
                </div>
              ))}
            </div>

            <div className="space-y-1 pt-3 border-t border-slate-100">
              <div className="flex justify-between text-sm"><span className="text-slate-600">Oraliq summa:</span><span>{formatMoney(view.subtotal)}</span></div>
              {view.discount > 0 && <div className="flex justify-between text-sm text-red-500"><span>Chegirma:</span><span>−{formatMoney(view.discount)}</span></div>}
              {view.taxAmount > 0 && <div className="flex justify-between text-sm"><span className="text-slate-600">Soliq:</span><span>{formatMoney(view.taxAmount)}</span></div>}
              <div className="flex justify-between font-bold text-lg pt-2"><span>Jami:</span><span className="text-emerald-600">{formatMoney(view.total)}</span></div>
              <div className="flex justify-between text-sm pt-1"><span className="text-slate-600">Tannarx (COGS):</span><span className="text-orange-600">{formatMoney(view.costOfGoods)}</span></div>
              <div className="flex justify-between font-semibold pt-1"><span className="text-slate-700">Sof foyda:</span><span className="text-emerald-600">{formatMoney(view.profit)}</span></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
