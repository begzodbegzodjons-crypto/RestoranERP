'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatMoney, formatNumber } from './utils'

type TopCustomer = {
  id: string
  name: string
  phone: string | null
  totalOrders: number
  totalRevenue: number
  avgOrderValue: number
  clv: number
  tier?: { name: string; color: string } | null
}

type TierBreakdown = {
  tier: string
  count: number
  totalClv: number
  avgClv: number
}

type CLVData = {
  summary?: {
    totalCustomers: number
    totalClv: number
    avgClv: number
    totalOrders: number
    avgOrdersPerCustomer: number
  }
  tierBreakdown?: TierBreakdown[]
  topCustomers?: TopCustomer[]
}

const TIER_COLORS: Record<string, string> = {
  VIP: 'bg-purple-50 text-purple-700 border-purple-200',
  High: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-blue-50 text-blue-700 border-blue-200',
  Low: 'bg-slate-100 text-slate-700 border-slate-200'
}

export default function CLVView() {
  const [data, setData] = useState<CLVData>({})
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/analytics/clv')
      setData(res || {})
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

  const s = data.summary
  const tiers = data.tierBreakdown || []
  const top = data.topCustomers || []

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">💎 CLV — Mijoz umri davomida qiymati</h2>
        <p className="text-slate-500 text-sm">Mijozning umumiy qiymati tahlili</p>
      </div>

      {s ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Jami mijozlar</div>
            <div className="font-bold text-slate-900 text-xl">{s.totalCustomers}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Jami CLV</div>
            <div className="font-bold text-emerald-600 text-xl">{formatMoney(s.totalClv)}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">O'rtacha CLV</div>
            <div className="font-bold text-blue-600 text-xl">{formatMoney(s.avgClv)}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">O'rtacha buyurtma</div>
            <div className="font-bold text-slate-900 text-xl">{formatNumber(s.avgOrdersPerCustomer)}</div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">💎</div>
          Ma'lumotlar yo'q
        </div>
      )}

      {tiers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 mb-4">📊 Daraja bo'yicha taqsimot</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiers.map(t => (
              <div
                key={t.tier}
                className={`rounded-xl border p-4 ${TIER_COLORS[t.tier] || 'bg-slate-50 border-slate-200'}`}
              >
                <div className="font-bold text-lg">{t.tier}</div>
                <div className="text-sm opacity-80">{t.count} mijoz</div>
                <div className="mt-2 text-sm">
                  <div>Jami: {formatMoney(t.totalClv)}</div>
                  <div>O'rtacha: {formatMoney(t.avgClv)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {top.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">🏆 Top 10 mijozlar</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Mijoz</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase">Buyurtma</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase">O'rtacha</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase">Daromad</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase">CLV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {top.map((c, i) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700'
                        : i === 1 ? 'bg-slate-200 text-slate-700'
                        : i === 2 ? 'bg-orange-100 text-orange-700'
                        : 'bg-slate-50 text-slate-500'
                      }`}>{i + 1}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      {c.tier && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: c.tier.color + '20', color: c.tier.color }}>
                          {c.tier.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{c.totalOrders}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatMoney(c.avgOrderValue)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatMoney(c.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatMoney(c.clv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
