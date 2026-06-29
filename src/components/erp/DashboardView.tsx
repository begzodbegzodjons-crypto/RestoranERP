'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, formatNumber, formatDateTime, Modal, useConfirm, toast } from './utils'

type Dashboard = {
  today: { sales: number; profit: number; cost: number; count: number }
  month: { sales: number; profit: number; cost: number; count: number; expenses: number; netProfit: number }
  chart7days: { date: string; sales: number; profit: number }[]
  counts: { products: number; ingredients: number; customers: number; staff: number; tables: number; lowStock: number }
  lowStock: any[]
  topProducts: { id: string; name: string; qty: number; revenue: number }[]
}

export default function DashboardView({ restaurantName }: { restaurantName: string }) {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/dashboard')
      setData(res)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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

  if (!data) return null

  const maxSales = Math.max(...data.chart7days.map(d => d.sales), 1)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
        <h2 className="text-2xl font-bold mb-1">Xush kelibsiz, {restaurantName}! 👋</h2>
        <p className="text-emerald-50">Bugungi savdo holati va umumiy ko'rsatkichlar</p>
      </div>

      {/* Today stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Bugungi savdo"
          value={formatMoney(data.today.sales)}
          sub={`${data.today.count} ta buyurtma`}
          color="emerald"
          icon="💰"
        />
        <StatCard
          title="Bugungi foyda"
          value={formatMoney(data.today.profit)}
          sub={`Tannarx: ${formatMoney(data.today.cost)}`}
          color="teal"
          icon="📈"
        />
        <StatCard
          title="Oylik savdo"
          value={formatMoney(data.month.sales)}
          sub={`${data.month.count} ta buyurtma`}
          color="cyan"
          icon="📅"
        />
        <StatCard
          title="Oylik sof foyda"
          value={formatMoney(data.month.netProfit)}
          sub={`Xarajatlar: ${formatMoney(data.month.expenses)}`}
          color={data.month.netProfit >= 0 ? 'emerald' : 'red'}
          icon={data.month.netProfit >= 0 ? '✓' : '⚠'}
        />
      </div>

      {/* Chart + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">So'nggi 7 kun savdolari</h3>
          <div className="space-y-3">
            {data.chart7days.map((d, i) => (
              <div key={d.date} className="flex items-center gap-3">
                <div className="w-24 text-sm text-slate-600">{new Date(d.date).toLocaleDateString('uz-UZ', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-8 overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-end pr-3 transition-all"
                    style={{ width: `${(d.sales / maxSales) * 100}%` }}
                  >
                    <span className="text-xs font-semibold text-white">{formatMoney(d.sales)}</span>
                  </div>
                </div>
                <div className="w-32 text-right text-sm font-medium text-emerald-600">
                  +{formatMoney(d.profit)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">🏆 Top mahsulotlar (30 kun)</h3>
          {data.topProducts.length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">Hozircha ma'lumot yo'q</p>
          ) : (
            <div className="space-y-3">
              {data.topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-slate-200 text-slate-700' :
                    i === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.qty} ta sotilgan</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-600">{formatMoney(p.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Counts grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <CountCard label="Mahsulotlar" value={data.counts.products} icon="🍽️" />
        <CountCard label="Ombor" value={data.counts.ingredients} icon="📦" />
        <CountCard label="Mijozlar" value={data.counts.customers} icon="👥" />
        <CountCard label="Xodimlar" value={data.counts.staff} icon="👷" />
        <CountCard label="Stollar" value={data.counts.tables} icon="🪑" />
        <CountCard label="Tugagan" value={data.counts.lowStock} icon="⚠️" alert={data.counts.lowStock > 0} />
      </div>

      {/* Low stock alert */}
      {data.lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-red-900 mb-3">⚠️ Omborda tugagan mahsulotlar</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.lowStock.map(item => (
              <div key={item.id} className="bg-white rounded-lg p-3 border border-red-100">
                <div className="font-semibold text-slate-900">{item.name}</div>
                <div className="text-sm text-red-600">Qoldiq: {formatNumber(item.stock)} {item.unit}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, sub, color, icon }: { title: string; value: string; sub: string; color: string; icon: string }) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500 to-teal-600',
    teal: 'from-teal-500 to-cyan-600',
    cyan: 'from-cyan-500 to-blue-600',
    red: 'from-red-500 to-orange-600'
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-xl shadow-md`}>
          {icon}
        </div>
      </div>
      <div className="text-sm text-slate-500 mb-1">{title}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  )
}

function CountCard({ label, value, icon, alert }: { label: string; value: number; icon: string; alert?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border ${alert ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
