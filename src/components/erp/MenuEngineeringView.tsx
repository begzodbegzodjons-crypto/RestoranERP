'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatMoney, formatNumber } from './utils'

type MenuItem = {
  id: string
  name: string
  category?: { name: string } | null
  totalSales: number
  totalRevenue: number
  totalProfit: number
  margin: number
  classification: 'star' | 'plowhorse' | 'puzzle' | 'dog'
}

const QUADRANTS = [
  {
    key: 'star',
    title: '⭐ Yulduzlar (Stars)',
    desc: 'Yuqori savdo + yuqorti foyda',
    color: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700'
  },
  {
    key: 'plowhorse',
    title: '🐴 Ish otlari (Plowhorses)',
    desc: 'Yuqori savdo + past foyda',
    color: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700'
  },
  {
    key: 'puzzle',
    title: '🧩 Boshqotirlar (Puzzles)',
    desc: 'Past savdo + yuqori foyda',
    color: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700'
  },
  {
    key: 'dog',
    title: '🐕 Itlar (Dogs)',
    desc: 'Past savdo + past foyda',
    color: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-700'
  }
] as const

export default function MenuEngineeringView() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/analytics/menu-engineering')
      setItems(res.items || [])
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

  const totalRevenue = items.reduce((s, i) => s + i.totalRevenue, 0)
  const totalProfit = items.reduce((s, i) => s + i.totalProfit, 0)
  const totalSales = items.reduce((s, i) => s + i.totalSales, 0)

  const byQuadrant = (key: string) => items.filter(i => i.classification === key)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">📊 Menu injiniringi (BCG matritsa)</h2>
        <p className="text-slate-500 text-sm">Taomlar savdo va foyda bo'yicha tahlil qilinadi</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Umumiy savdo</div>
          <div className="font-bold text-slate-900 text-lg">{totalSales} ta</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Umumiy tushum</div>
          <div className="font-bold text-emerald-600 text-lg">{formatMoney(totalRevenue)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Umumiy foyda</div>
          <div className="font-bold text-blue-600 text-lg">{formatMoney(totalProfit)}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">📊</div>
          Ma'lumotlar yetarli emas
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {QUADRANTS.map(q => {
            const list = byQuadrant(q.key)
            const sorted = list.slice().sort((a, b) => b.totalRevenue - a.totalRevenue)
            return (
              <div key={q.key} className={`rounded-2xl border-2 p-5 ${q.color}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-slate-900">{q.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{q.desc}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${q.badge}`}>{list.length}</span>
                </div>

                {sorted.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Bu kvadrantda taomlar yo'q</p>
                ) : (
                  <div className="space-y-1.5 max-h-[40vh] overflow-y-auto custom-scroll">
                    {sorted.map(it => (
                      <div key={it.id} className="bg-white rounded-lg p-2.5 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-slate-800 truncate">
                            {it.name}
                            {it.category && <span className="text-xs text-slate-400 ml-2">({it.category.name})</span>}
                          </div>
                          <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{it.totalSales}x</span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-xs">
                          <span className="text-emerald-700">💰 {formatMoney(it.totalRevenue)}</span>
                          <span className="text-blue-700">📈 {formatMoney(it.totalProfit)}</span>
                          <span className="text-slate-500">marja: {formatNumber(it.margin)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
