'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, formatDateTime } from './utils'

type TaxData = {
  totalRevenue: number
  taxableRevenue: number
  totalTaxCollected: number
  totalExpenses: number
  netProfit: number
  profitTax: number
  totalTax: number
  netAfterTax: number
  byPaymentMethod?: Array<{ method: string; revenue: number; tax: number; count: number }>
  period?: { from: string; to: string }
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Naqd',
  card: 'Karta',
  click: 'Click',
  payme: 'Payme',
  transfer: 'Bank o\'tkazmasi'
}

export default function TaxView() {
  const [data, setData] = useState<TaxData | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))

  const load = async () => {
    setLoading(true)
    try {
      const res = await api<TaxData>(`/api/tax/calculate?from=${from}&to=${to}`)
      setData(res)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const cards = data ? [
    { label: 'Umumiy tushum', value: data.totalRevenue, color: 'bg-slate-50 text-slate-900 border-slate-200' },
    { label: 'Soliqqa tortiladigan tushum', value: data.taxableRevenue, color: 'bg-blue-50 text-blue-900 border-blue-200' },
    { label: 'QQS (12%) — yig\'ilgan', value: data.totalTaxCollected, color: 'bg-amber-50 text-amber-900 border-amber-200' },
    { label: 'Umumiy xarajatlar', value: data.totalExpenses, color: 'bg-red-50 text-red-900 border-red-200' },
    { label: 'Sof foyda', value: data.netProfit, color: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
    { label: 'Foyda solig\'i (15%)', value: data.profitTax, color: 'bg-purple-50 text-purple-900 border-purple-200' },
    { label: 'Jami soliqlar', value: data.totalTax, color: 'bg-rose-50 text-rose-900 border-rose-200' },
    { label: 'Sof foyda (soliqdan keyin)', value: data.netAfterTax, color: 'bg-teal-50 text-teal-900 border-teal-200' }
  ] : []

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
      <div>
        <h2 className="text-2xl font-bold text-slate-900">🧾 Soliq hisobi</h2>
        <p className="text-slate-500 text-sm">QQS 12% va foyda solig\'i 15% hisob-kitobi</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Dan</label>
          <input type="date" className="erp-input" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Gacha</label>
          <input type="date" className="erp-input" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button
          onClick={load}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600"
        >
          Hisoblash
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <div key={i} className={`rounded-xl border p-4 ${c.color}`}>
            <div className="text-xs font-medium opacity-75 mb-1">{c.label}</div>
            <div className="text-lg font-bold">{formatMoney(c.value)}</div>
          </div>
        ))}
      </div>

      {data?.byPaymentMethod && data.byPaymentMethod.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">To\'lov usullari bo\'yicha</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Usul</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Tushum</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">QQS</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Operatsiyalar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.byPaymentMethod.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900 font-medium">
                      {PAYMENT_LABELS[row.method] || row.method}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">{formatMoney(row.revenue)}</td>
                    <td className="px-4 py-3 text-right text-amber-700 font-medium">{formatMoney(row.tax)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold">Davr</div>
            <div className="text-slate-900 font-medium">
              {from} — {to}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase font-semibold">Jami soliq (QQS + foyda)</div>
            <div className="text-2xl font-bold text-rose-600">{data ? formatMoney(data.totalTax) : '—'}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase font-semibold">Sof foyda</div>
            <div className="text-2xl font-bold text-emerald-600">{data ? formatMoney(data.netAfterTax) : '—'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
