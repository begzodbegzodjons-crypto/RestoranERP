'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, formatDateTime, formatNumber } from './utils'

type Report = {
  range: { from: string; to: string }
  summary: {
    totalSales: number
    totalProfit: number
    totalCost: number
    totalExpenses: number
    totalPurchases: number
    netProfit: number
    orderCount: number
    avgOrder: number
    profitMargin: number
  }
  byCategory: { name: string; qty: number; revenue: number; profit: number }[]
  byProduct: { name: string; qty: number; revenue: number; profit: number }[]
  byPayment: { method: string; total: number }[]
  byDay: { date: string; sales: number; profit: number; orders: number }[]
  recentSales: any[]
  expenses: any[]
  purchases: any[]
}

export default function ReportsView() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(`/api/reports?from=${from}&to=${to}`)
      setReport(res)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading || !report) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  const s = report.summary

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">📊 Hisobotlar</h2>
          <p className="text-slate-500 text-sm">Davr: {from} → {to}</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" className="erp-input" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-slate-400">→</span>
          <input type="date" className="erp-input" value={to} onChange={e => setTo(e.target.value)} />
          <button onClick={load} className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold">Ko'rsatish</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Jami savdo" value={formatMoney(s.totalSales)} color="emerald" />
        <Stat label="Sof foyda (savdo)" value={formatMoney(s.totalProfit)} color="teal" />
        <Stat label="Xarajatlar" value={formatMoney(s.totalExpenses)} color="red" />
        <Stat label="Sof foyda (yakuniy)" value={formatMoney(s.netProfit)} color={s.netProfit >= 0 ? 'emerald' : 'red'} />
        <Stat label="Tannarx (COGS)" value={formatMoney(s.totalCost)} color="orange" />
        <Stat label="Kirim (sotib olish)" value={formatMoney(s.totalPurchases)} color="cyan" />
        <Stat label="Buyurtmalar" value={s.orderCount + ' ta'} color="slate" />
        <Stat label="O'rtacha chek" value={formatMoney(s.avgOrder)} color="slate" />
      </div>

      {/* Profit margin banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-emerald-50 text-sm">Foyda marjasi</div>
            <div className="text-4xl font-bold">{s.profitMargin.toFixed(1)}%</div>
          </div>
          <div className="text-right">
            <div className="text-emerald-50 text-sm">Yakuniy sof foyda</div>
            <div className="text-4xl font-bold">{formatMoney(s.netProfit)}</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily sales */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">📅 Kunlik savdo</h3>
          {report.byDay.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scroll">
              {(() => {
                const max = Math.max(...report.byDay.map(d => d.sales), 1)
                return report.byDay.map(d => (
                  <div key={d.date} className="flex items-center gap-2">
                    <div className="w-20 text-xs text-slate-500">{new Date(d.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })}</div>
                    <div className="flex-1 bg-slate-100 rounded h-6 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${(d.sales / max) * 100}%` }} />
                    </div>
                    <div className="w-24 text-right text-xs font-semibold text-slate-700">{formatMoney(d.sales)}</div>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>

        {/* By payment method */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">💳 To'lov turlari</h3>
          {report.byPayment.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p>
          ) : (
            <div className="space-y-3">
              {report.byPayment.map(p => {
                const total = report.byPayment.reduce((s, x) => s + x.total, 0)
                const pct = total > 0 ? (p.total / total) * 100 : 0
                const labels: Record<string, string> = { cash: '💵 Naqd', card: '💳 Karta', transfer: '🔄 O\'tkazma' }
                return (
                  <div key={p.method}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700">{labels[p.method] || p.method}</span>
                      <span className="font-semibold text-slate-900">{formatMoney(p.total)} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="bg-slate-100 rounded h-3 overflow-hidden">
                      <div className="h-full bg-teal-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* By category and product */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">👤 Ofitsiantlar bo'yicha</h3>
          {(!report.byWaiter || report.byWaiter.length === 0) ? (
            <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p>
          ) : (
            <div className="space-y-2">
              {report.byWaiter.map((w: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{w.name}</div>
                      <div className="text-xs text-slate-500">{w.orders} ta buyurtma</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{formatMoney(w.revenue)}</div>
                    <div className="text-xs text-emerald-600">+{formatMoney(w.profit)} foyda</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">🪑 Stollar bo'yicha</h3>
          {(!report.byTable || report.byTable.length === 0) ? (
            <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scroll">
              {report.byTable.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🪑</span>
                    <div>
                      <div className="font-medium text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.orders} ta buyurtma</div>
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900">{formatMoney(t.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* By category and product */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">🏷️ Kategoriyalar bo'yicha</h3>
          {report.byCategory.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p>
          ) : (
            <div className="space-y-2">
              {report.byCategory.map(c => (
                <div key={c.name} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{formatMoney(c.revenue)}</div>
                    <div className="text-xs text-emerald-600">+{formatMoney(c.profit)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">🍽️ Mahsulotlar bo'yicha</h3>
          {report.byProduct.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scroll">
              {report.byProduct.slice(0, 15).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-xs text-slate-400">{i + 1}</span>
                    <div className="font-medium text-slate-900 text-sm">{p.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900 text-sm">{formatMoney(p.revenue)}</div>
                    <div className="text-xs text-slate-500">{formatNumber(p.qty)} ta</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent sales and expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">🧾 So'nggi savdolar</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scroll">
            {report.recentSales.length === 0 ? (
              <p className="text-center text-slate-400 py-6">Savdo yo'q</p>
            ) : report.recentSales.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-2 border-b border-slate-50 last:border-0">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-slate-900">{s.invoiceNo}</div>
                  <div className="text-xs text-slate-400">{formatDateTime(s.createdAt)}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {s.tableName && <span className="text-xs text-slate-500">🪑 {s.tableName}</span>}
                    {s.waiterName && <span className="text-xs text-slate-500">👤 {s.waiterName}</span>}
                    {s.kassir && <span className="text-xs text-slate-400">💳 {s.kassir}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-slate-900">{formatMoney(s.total)}</div>
                  <div className="text-xs text-emerald-600">+{formatMoney(s.profit)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">💸 So'nggi xarajatlar</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scroll">
            {report.expenses.length === 0 ? (
              <p className="text-center text-slate-400 py-6">Xarajat yo'q</p>
            ) : report.expenses.map((e: any) => {
              const m: Record<string, string> = { rent: '🏠 Ijara', salary: '👷 Maosh', utility: '💡 Kommunal', marketing: '📢 Reklama', equipment: '🔧 Uskuna', other: '📦 Boshqa' }
              return (
                <div key={e.id} className="flex items-center justify-between p-2 border-b border-slate-50 last:border-0">
                  <div>
                    <div className="font-medium text-sm text-slate-900">{m[e.category] || e.category}</div>
                    <div className="text-xs text-slate-400">{e.description || '—'} • {formatDateTime(e.date)}</div>
                  </div>
                  <div className="font-bold text-red-500">−{formatMoney(e.amount)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600',
    teal: 'text-teal-600',
    cyan: 'text-cyan-600',
    red: 'text-red-500',
    orange: 'text-orange-600',
    slate: 'text-slate-900'
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${colors[color] || colors.slate}`}>{value}</div>
    </div>
  )
}
