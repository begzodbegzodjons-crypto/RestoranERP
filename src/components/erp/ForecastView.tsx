'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatMoney, formatNumber } from './utils'

type ForecastDay = {
  date: string
  dayOfWeek: number
  predictedRevenue: number
  predictedProfit: number
  confidence: number
}

type DayOfWeekAvg = {
  dayOfWeek: number
  avgRevenue: number
  label: string
}

type ForecastData = {
  insight?: string
  ma7?: number
  ma14?: number
  ma30?: number
  trendPercent?: number
  totalForecastRevenue?: number
  totalForecastProfit?: number
  avgProfitMargin?: number
  forecast?: ForecastDay[]
  dayOfWeekAverages?: DayOfWeekAvg[]
}

const DAYS_UZ = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']

export default function ForecastView() {
  const [data, setData] = useState<ForecastData>({})
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(`/api/analytics/forecast?days=${days}`)
      setData(res || {})
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days])

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

  const forecast = data.forecast || []
  const dowAverages = data.dayOfWeekAverages || []
  const maxDowAvg = Math.max(...dowAverages.map(d => d.avgRevenue), 1)
  const trend = data.trendPercent || 0
  const trendUp = trend >= 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">📈 AI savdo prognozi</h2>
          <p className="text-slate-500 text-sm">Sun'iy intellekt asosida kelgusi savdo bashorati</p>
        </div>
        <select
          value={days}
          onChange={e => setDays(parseInt(e.target.value))}
          className="erp-input max-w-[180px]"
        >
          <option value={7}>7 kunlik</option>
          <option value={14}>14 kunlik</option>
          <option value={30}>30 kunlik</option>
        </select>
      </div>

      {data.insight && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl shrink-0">
            🤖
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-purple-700 uppercase mb-1">AI tahlili</div>
            <p className="text-sm text-slate-800 leading-relaxed">{data.insight}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="7 kun MA"
          value={formatMoney(data.ma7 || 0)}
          icon="📊"
          color="slate"
        />
        <SummaryCard
          label="14 kun MA"
          value={formatMoney(data.ma14 || 0)}
          icon="📈"
          color="blue"
        />
        <SummaryCard
          label="30 kun MA"
          value={formatMoney(data.ma30 || 0)}
          icon="📉"
          color="purple"
        />
        <SummaryCard
          label="Trend"
          value={`${trendUp ? '+' : ''}${formatNumber(trend)}%`}
          icon={trendUp ? '📈' : '📉'}
          color={trendUp ? 'emerald' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard
          label="Jami prognoz daromad"
          value={formatMoney(data.totalForecastRevenue || 0)}
          icon="💰"
          color="emerald"
          big
        />
        <SummaryCard
          label="Jami prognoz foyda"
          value={formatMoney(data.totalForecastProfit || 0)}
          icon="💎"
          color="teal"
          big
        />
        <SummaryCard
          label="O'rtacha foyda marjasi"
          value={`${formatNumber(data.avgProfitMargin || 0)}%`}
          icon="🎯"
          color="amber"
          big
        />
      </div>

      {forecast.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">📅 Kunlik prognoz ({forecast.length} kun)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Sana</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Kun</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase">Daromad</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase">Foyda</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase">Ishonch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {forecast.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {new Date(d.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {DAYS_UZ[d.dayOfWeek] || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-medium">
                      {formatMoney(d.predictedRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                      {formatMoney(d.predictedProfit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                        d.confidence >= 80 ? 'bg-emerald-50 text-emerald-700'
                        : d.confidence >= 60 ? 'bg-amber-50 text-amber-700'
                        : 'bg-red-50 text-red-700'
                      }`}>
                        {formatNumber(d.confidence)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dowAverages.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 mb-4">📊 Hafta kunlari bo'yicha o'rtacha savdo</h3>
          <div className="flex items-end gap-2 h-48">
            {dowAverages.map((d, i) => {
              const heightPct = Math.max((d.avgRevenue / maxDowAvg) * 100, 2)
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                  <div className="text-xs font-semibold text-slate-700">
                    {d.avgRevenue > 0 ? formatMoney(d.avgRevenue).replace(' UZS', '') : '—'}
                  </div>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 transition-colors"
                    style={{ height: `${heightPct}%` }}
                    title={formatMoney(d.avgRevenue)}
                  />
                  <div className="text-xs text-slate-500 font-medium">{d.label || DAYS_UZ[d.dayOfWeek]}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {forecast.length === 0 && dowAverages.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">📈</div>
          Prognoz ma'lumotlari mavjud emas. AI modeli uchun yetarli tarixiy ma'lumot kerak.
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  color,
  big
}: {
  label: string
  value: string
  icon: string
  color: 'slate' | 'blue' | 'purple' | 'emerald' | 'teal' | 'amber' | 'red'
  big?: boolean
}) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700'
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${colors[color]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`font-bold text-slate-900 ${big ? 'text-lg' : ''} truncate`}>{value}</div>
      </div>
    </div>
  )
}
