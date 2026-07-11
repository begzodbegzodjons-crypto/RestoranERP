'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatDateTime } from './utils'

type FeatureFlag = {
  id: string
  feature: string
  enabled: boolean
  description: string | null
  updatedAt: string
  updatedBy?: { name: string } | null
}

export default function FeatureFlagsView() {
  const [items, setItems] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/feature-flags')
      setItems(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggle = async (f: FeatureFlag) => {
    setToggling(f.id)
    try {
      await api('/api/feature-flags', {
        method: 'POST',
        body: JSON.stringify({ feature: f.feature, enabled: !f.enabled })
      })
      toast.success(`${f.feature} ${!f.enabled ? 'yoqildi' : 'o\'chirildi'}`)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setToggling(null)
    }
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

  const enabledCount = items.filter(i => i.enabled).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🎛️ Feature flaglar</h2>
          <p className="text-slate-500 text-sm">
            {enabledCount}/{items.length} yoqilgan • Funksiyalarni real vaqtda boshqaring
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
        >
          ↻ Yangilash
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🎛️</div>
          Feature flaglar yo'q
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(f => {
            const isToggling = toggling === f.id
            return (
              <div
                key={f.id}
                className={`bg-white rounded-2xl border-2 p-4 transition-colors ${
                  f.enabled ? 'border-emerald-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{f.feature}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        f.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {f.enabled ? '✓ Yoqilgan' : '✗ O\'chirilgan'}
                      </span>
                    </div>
                    {f.description && (
                      <p className="text-sm text-slate-600 mt-1">{f.description}</p>
                    )}
                    <div className="text-xs text-slate-400 mt-2">
                      {f.updatedAt && <span>🕒 {formatDateTime(f.updatedAt)}</span>}
                      {f.updatedBy?.name && <span className="ml-2">👤 {f.updatedBy.name}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(f)}
                    disabled={isToggling}
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      f.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        f.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        💡 <span className="font-medium">Maslahat:</span> Feature flaglar tizimni qayta ishga tushirmasdan funksiyalarni yoqish/o'chirish imkonini beradi.
      </div>
    </div>
  )
}
