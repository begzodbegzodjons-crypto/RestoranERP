'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatMoney, formatNumber, Modal } from './utils'

type Tab = 'hourly' | 'profitable' | 'customers' | 'forecast' | 'abtests'

export default function AnalyticsView() {
  const [tab, setTab] = useState<Tab>('hourly')
  const [days, setDays] = useState(30)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">📊 Biznes analitikasi (BI)</h2>
          <p className="text-slate-500 text-sm">Avtomatik tahlil va prognoz - biznesingizni o'stiring</p>
        </div>
        <select
          value={days}
          onChange={e => setDays(parseInt(e.target.value))}
          className="erp-input max-w-[180px]"
        >
          <option value={7}>So'nggi 7 kun</option>
          <option value={30}>So'nggi 30 kun</option>
          <option value={90}>So'nggi 90 kun</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-200 w-fit overflow-x-auto max-w-full">
        {[
          { v: 'hourly', l: '🕐 Soatlik savdo' },
          { v: 'profitable', l: '💰 Foydali taomlar' },
          { v: 'customers', l: '👥 Mijozlar' },
          { v: 'forecast', l: '📈 Prognoz' },
          { v: 'abtests', l: '🧪 Narx A/B test' }
        ].map(t => (
          <button
            key={t.v}
            onClick={() => setTab(t.v as Tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === t.v ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'hourly' && <HourlyAnalytics days={days} />}
      {tab === 'profitable' && <ProfitableDishes days={days} />}
      {tab === 'customers' && <CustomerBehavior days={days} />}
      {tab === 'forecast' && <ForecastAnalytics />}
      {tab === 'abtests' && <ABTestsAnalytics />}
    </div>
  )
}

// ============== HOURLY ANALYTICS ==============
function HourlyAnalytics({ days }: { days: number }) {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    api(`/api/analytics/hourly?days=${days}`)
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [days])

  if (loading) return <Spinner />
  if (!data) return null

  const maxSales = Math.max(...data.hourlyData.map((h: any) => h.sales), 1)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigStat label="Jami savdo" value={formatMoney(data.summary.totalSales)} icon="💰" color="emerald" />
        <BigStat label="Buyurtmalar" value={`${data.summary.totalOrders} ta`} icon="🧾" color="blue" />
        <BigStat label="O'rtacha chek" value={formatMoney(data.summary.avgOrder)} icon="📊" color="purple" />
        <BigStat label="Eng band soat" value={`${data.summary.peakHour}:00`} icon="🔥" color="amber" />
      </div>

      {/* Hourly chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">🕐 Soatlik savdo grafigi</h3>
        <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scroll">
          {data.hourlyData.map((h: any) => (
            <div key={h.hour} className="flex items-center gap-3">
              <div className="w-12 text-xs text-slate-500 font-medium">{h.label}</div>
              <div className="flex-1 bg-slate-100 rounded h-6 overflow-hidden relative">
                <div
                  className={`h-full rounded transition-all ${h.orderCount > 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : ''}`}
                  style={{ width: `${(h.sales / maxSales) * 100}%`, minWidth: h.orderCount > 0 ? '4px' : '0' }}
                />
                {h.orderCount > 0 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-700">
                    {formatMoney(h.sales)} ({h.orderCount} ta)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Day parts */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">📅 Kun davomida tahlil</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.dayParts.map((p: any) => (
            <div key={p.name} className="bg-slate-50 rounded-xl p-4">
              <div className="text-sm font-medium text-slate-700 mb-1">{p.name}</div>
              <div className="text-2xl font-bold text-slate-900">{p.count}</div>
              <div className="text-xs text-slate-500">{p.percent.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Busiest hours */}
      {data.busiestHours.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-6">
          <h3 className="font-bold text-amber-900 mb-3">🔥 Eng band soatlar (TOP 3)</h3>
          <div className="space-y-2">
            {data.busiestHours.map((h: any, i: number) => (
              <div key={h.hour} className="flex items-center gap-3 bg-white rounded-lg p-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{h.label}</div>
                  <div className="text-xs text-slate-500">{h.orderCount} ta buyurtma, {formatMoney(h.sales)}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-700 mt-3">
            💡 Bu soatlarda ko'proq xodim kerak. Menu yangilang, promo taklif qiling.
          </p>
        </div>
      )}
    </div>
  )
}

// ============== PROFITABLE DISHES ==============
function ProfitableDishes({ days }: { days: number }) {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    api(`/api/analytics/profitable-dishes?days=${days}`)
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [days])

  if (loading) return <Spinner />
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigStat label="Jami daromad" value={formatMoney(data.summary.totalRevenue)} icon="💰" color="emerald" />
        <BigStat label="Jami foyda" value={formatMoney(data.summary.totalProfit)} icon="📈" color="teal" />
        <BigStat label="O'rtacha marja" value={`${data.summary.avgMargin.toFixed(1)}%`} icon="🎯" color="purple" />
        <BigStat label="Taomlar" value={`${data.summary.totalProducts} ta`} icon="🍽️" color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top profitable */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">💰 Eng foydali taomlar (so'm bo'yicha)</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scroll">
            {data.topProfitable.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">{p.name}</div>
                  <div className="text-xs text-slate-500">{formatNumber(p.qtySold)} ta sotilgan</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-600">{formatMoney(p.profit)}</div>
                  <div className="text-xs text-slate-500">{p.margin.toFixed(1)}% marja</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top margin */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">🎯 Eng yuqori marja (%)</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scroll">
            {data.topMargin.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">{p.name}</div>
                  <div className="text-xs text-slate-500">Sotuv: {formatMoney(p.price)}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-purple-600">{p.margin.toFixed(1)}%</div>
                  <div className="text-xs text-slate-500">{formatMoney(p.profit)} foyda</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top selling */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">🏆 Eng ko'p sotilgan</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scroll">
            {data.topSelling.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">{formatNumber(p.qtySold)} ta</div>
                </div>
                <div className="text-right font-semibold text-blue-600">{formatMoney(p.revenue)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Least profitable */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">⚠️ Eng kam foydali</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scroll">
            {data.leastProfitable.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <div className="text-xl">⚠️</div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">Marja: {p.margin.toFixed(1)}%</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-red-500">{formatMoney(p.profit)}</div>
                  <div className="text-xs text-slate-500">{formatNumber(p.qtySold)} ta</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============== CUSTOMER BEHAVIOR ==============
function CustomerBehavior({ days }: { days: number }) {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    api(`/api/analytics/customer-behavior?days=${days}`)
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [days])

  if (loading) return <Spinner />
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigStat label="Jami mijozlar" value={`${data.summary.totalCustomers}`} icon="👥" color="blue" />
        <BigStat label="Qaytadan kelgan" value={`${data.summary.returningCustomers}`} icon="🔁" color="emerald" />
        <BigStat label="Retention rate" value={`${data.summary.retentionRate.toFixed(1)}%`} icon="📊" color="purple" />
        <BigStat label="VIP mijozlar" value={`${data.summary.vipCustomers}`} icon="⭐" color="amber" />
      </div>

      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-emerald-50 text-sm">O'rtacha oraliq</div>
            <div className="text-2xl font-bold">{data.summary.avgDaysBetweenOrders.toFixed(1)} kun</div>
            <div className="text-xs text-emerald-50">buyurtmalar orasida</div>
          </div>
          <div>
            <div className="text-emerald-50 text-sm">Yangi mijozlar</div>
            <div className="text-2xl font-bold">{data.summary.newCustomers}</div>
            <div className="text-xs text-emerald-50">1 marta kelgan</div>
          </div>
          <div>
            <div className="text-emerald-50 text-sm">Churn xavfi</div>
            <div className="text-2xl font-bold">{data.churnRisk}</div>
            <div className="text-xs text-emerald-50">30+ kun kelmagan</div>
          </div>
        </div>
      </div>

      {/* Frequency distribution */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">📊 Mijozlar chastotasi</h3>
        <div className="space-y-3">
          {data.frequencyBuckets.map((b: any) => (
            <div key={b.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-700">{b.label}</span>
                <span className="font-semibold">{b.count} ta ({b.percent.toFixed(1)}%)</span>
              </div>
              <div className="bg-slate-100 rounded h-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${b.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top spenders */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">💎 Top mijozlar (eng ko'p sarflagan)</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Mijoz</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Buyurtmalar</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Sarflagan</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">O'rtacha</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Ballar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.topSpenders.map((c: any, i: number) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {i < 3 && <span className="text-lg">🏆</span>}
                      <div>
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.phone || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{c.totalOrders}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatMoney(c.totalSpent)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatMoney(c.avgOrder)}</td>
                  <td className="px-4 py-3 text-right text-amber-600 font-semibold">{c.loyaltyPoints || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============== FORECAST ==============
function ForecastAnalytics() {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    api('/api/analytics/forecast')
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (!data) return null

  const allData = [...data.historical, ...data.forecast]
  const maxSales = Math.max(...allData.map((m: any) => m.sales || m.forecastedSales || 0), 1)

  const trendIcon = data.trend.direction === 'growing' ? '📈' : data.trend.direction === 'declining' ? '📉' : '➡️'
  const trendLabel = data.trend.direction === 'growing' ? 'O\'sish' : data.trend.direction === 'declining' ? 'Pasayish' : 'Barqaror'
  const trendColor = data.trend.direction === 'growing' ? 'emerald' : data.trend.direction === 'declining' ? 'red' : 'slate'

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigStat label="6 oy savdo" value={formatMoney(data.summary.totalSales6Months)} icon="💰" color="emerald" />
        <BigStat label="O'rtacha oylik" value={formatMoney(data.summary.avgMonthlySales)} icon="📊" color="blue" />
        <BigStat label="Keyingi oy prognoz" value={formatMoney(data.summary.nextMonthForecast)} icon="🔮" color="purple" />
        <BigStat label="Eng yaxshi mavsum" value={data.summary.bestSeason} icon="☀️" color="amber" />
      </div>

      {/* Trend banner */}
      <div className={`rounded-2xl p-6 ${trendColor === 'emerald' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white' : trendColor === 'red' ? 'bg-gradient-to-br from-red-500 to-orange-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm opacity-80">Trend tahlili</div>
            <div className="text-3xl font-bold flex items-center gap-2">
              {trendIcon} {trendLabel}
              {data.trend.percent !== 0 && (
                <span className="text-lg">({data.trend.percent > 0 ? '+' : ''}{data.trend.percent.toFixed(1)}%)</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-80">O'rtacha oylik o'sish</div>
            <div className="text-2xl font-bold">{data.trend.avgGrowthRate > 0 ? '+' : ''}{data.trend.avgGrowthRate.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Chart: Historical + Forecast */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">📈 Oylik savdo va prognoz (OTS)</h3>
        <div className="space-y-2">
          {allData.map((m: any) => {
            const value = m.sales || m.forecastedSales || 0
            const isForecast = m.isForecast
            return (
              <div key={m.monthKey} className="flex items-center gap-3">
                <div className="w-24 text-sm text-slate-600">{m.month}</div>
                <div className="flex-1 bg-slate-100 rounded h-8 overflow-hidden relative">
                  <div
                    className={`h-full rounded flex items-center justify-end pr-2 ${isForecast ? 'bg-gradient-to-r from-purple-400 to-purple-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}
                    style={{ width: `${(value / maxSales) * 100}%`, minWidth: value > 0 ? '60px' : '0' }}
                  >
                    <span className="text-xs font-semibold text-white">{formatMoney(value)}</span>
                  </div>
                  {isForecast && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-purple-700">
                      🔮 Prognoz
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500"></div>
            <span className="text-slate-600">Haqiqiy savdo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-purple-500"></div>
            <span className="text-slate-600">Prognoz (OTS - Oddiy Trend Satri)</span>
          </div>
        </div>
      </div>

      {/* Growth rates */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">📊 Oylik o'sish sur'ati</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {data.growthRates.map((g: any) => (
            <div key={g.month} className={`rounded-xl p-3 ${g.growth > 0 ? 'bg-emerald-50' : g.growth < 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
              <div className="text-xs text-slate-500">{g.month}</div>
              <div className={`text-xl font-bold ${g.growth > 0 ? 'text-emerald-600' : g.growth < 0 ? 'text-red-500' : 'text-slate-600'}`}>
                {g.growth > 0 ? '+' : ''}{g.growth.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Seasonality */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">🍂 Mavsumiylik tahlili</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.seasons.map((s: any) => {
            const maxSeason = Math.max(...data.seasons.map((x: any) => x.total), 1)
            const icon = s.season === 'Qish' ? '❄️' : s.season === 'Bahor' ? '🌸' : s.season === 'Yoz' ? '☀️' : '🍂'
            return (
              <div key={s.season} className="bg-slate-50 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">{icon}</div>
                <div className="font-semibold text-slate-900">{s.season}</div>
                <div className="text-lg font-bold text-emerald-600">{formatMoney(s.total)}</div>
                <div className="w-full bg-slate-200 rounded h-1.5 mt-2 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${(s.total / maxSeason) * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============== A/B TESTS ==============
function ABTestsAnalytics() {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true) // eslint-disable-line react-hooks/set-state-in-effect
    api('/api/analytics/ab-tests')
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (!data) return null

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <BigStat label="Tahlil qilingan taomlar" value={`${data.summary.totalProductsAnalyzed}`} icon="🍽️" color="blue" />
        <BigStat label="Ijobiy ta'sir" value={`${data.summary.positiveImpact}`} icon="✅" color="emerald" />
        <BigStat label="Salbiy ta'sir" value={`${data.summary.negativeImpact}`} icon="⚠️" color="red" />
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="font-semibold text-blue-900 mb-1">🧪 Narx A/B testi nima?</div>
        <p className="text-sm text-blue-800">
          Avtomatik tahlil: mahsulot narxi o'zgartirilgan sanadan 14 kun oldin va 14 kun keyin savdoni solishtiradi.
          Talab elastikligi va tavsiyalar avtomatik hisoblanadi.
        </p>
      </div>

      {/* Results */}
      {data.results.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🧪</div>
          Hozircha narx o'zgartirish tahlili mavjud emas.
          <div className="text-sm mt-2">
            Taomlarni narxini o'zgartiring - 7 kundan keyin avtomatik tahlil paydo bo'ladi.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {data.results.map((r: any) => (
            <div key={r.productId} className={`bg-white rounded-2xl border-2 p-5 ${
              r.recommendationType === 'success' ? 'border-emerald-200' :
              r.recommendationType === 'danger' ? 'border-red-200' :
              r.recommendationType === 'warning' ? 'border-amber-200' :
              'border-slate-200'
            }`}>
              <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                <div>
                  <div className="font-bold text-slate-900 text-lg">{r.productName}</div>
                  <div className="text-xs text-slate-500">Joriy narx: {formatMoney(r.currentPrice)} • Narx o'zgartirilgan: {new Date(r.changeDate).toLocaleDateString('uz-UZ')}</div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  r.recommendationType === 'success' ? 'bg-emerald-100 text-emerald-700' :
                  r.recommendationType === 'danger' ? 'bg-red-100 text-red-700' :
                  r.recommendationType === 'warning' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  Narx {r.priceChange > 0 ? '↑' : '↓'} {Math.abs(r.priceChange).toFixed(1)}%
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Oldin (14 kun)</div>
                  <div className="font-bold text-slate-900">{formatNumber(r.before.qty)} ta</div>
                  <div className="text-xs text-slate-500">{formatMoney(r.before.revenue)}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Keyin (14 kun)</div>
                  <div className="font-bold text-slate-900">{formatNumber(r.after.qty)} ta</div>
                  <div className="text-xs text-slate-500">{formatMoney(r.after.revenue)}</div>
                </div>
                <div className={`rounded-lg p-3 ${r.qtyChange > 0 ? 'bg-emerald-50' : r.qtyChange < 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                  <div className="text-xs text-slate-500">Miqdor o'zgarishi</div>
                  <div className={`font-bold ${r.qtyChange > 0 ? 'text-emerald-600' : r.qtyChange < 0 ? 'text-red-500' : 'text-slate-600'}`}>
                    {r.qtyChange > 0 ? '+' : ''}{r.qtyChange.toFixed(1)}%
                  </div>
                </div>
                <div className={`rounded-lg p-3 ${r.revenueChange > 0 ? 'bg-emerald-50' : r.revenueChange < 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                  <div className="text-xs text-slate-500">Daromad o'zgarishi</div>
                  <div className={`font-bold ${r.revenueChange > 0 ? 'text-emerald-600' : r.revenueChange < 0 ? 'text-red-500' : 'text-slate-600'}`}>
                    {r.revenueChange > 0 ? '+' : ''}{r.revenueChange.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Recommendation */}
              <div className={`rounded-lg p-3 text-sm ${
                r.recommendationType === 'success' ? 'bg-emerald-50 text-emerald-800' :
                r.recommendationType === 'danger' ? 'bg-red-50 text-red-800' :
                r.recommendationType === 'warning' ? 'bg-amber-50 text-amber-800' :
                'bg-slate-50 text-slate-700'
              }`}>
                💡 <span className="font-semibold">Tavsiya:</span> {r.recommendation}
                {r.elasticity !== 0 && (
                  <span className="block mt-1 text-xs">
                    Talab elastikligi: {r.elasticity.toFixed(2)} ({Math.abs(r.elasticity) > 1 ? 'elastik' : 'elastik emas'})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============== HELPERS ==============
function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

function BigStat({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500 to-teal-600',
    teal: 'from-teal-500 to-cyan-600',
    blue: 'from-blue-500 to-cyan-600',
    purple: 'from-purple-500 to-pink-600',
    amber: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-orange-600',
    slate: 'from-slate-600 to-slate-700'
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-xl shadow-md mb-3`}>{icon}</div>
      <div className="text-sm text-slate-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
    </div>
  )
}
