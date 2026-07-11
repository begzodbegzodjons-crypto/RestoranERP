'use client'

import { useState, useEffect } from 'react'
import { api, toast, Modal, formatDateTime } from './utils'

type InventoryCount = {
  id: string
  status: string
  startedAt: string
  completedAt: string | null
  notes: string | null
  _count?: { items: number }
  startedBy?: { name: string } | null
}

type CountItem = {
  id: string
  expectedQuantity: number
  actualQuantity: number | null
  variance: number
  ingredient?: { id: string; name: string; unit: string } | null
}

export default function InventoryCountsView() {
  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [selected, setSelected] = useState<InventoryCount | null>(null)
  const [items, setItems] = useState<CountItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/inventory-counts')
      setCounts(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCount = async (c: InventoryCount) => {
    setSelected(c)
    setLoadingItems(true)
    try {
      const res = await api(`/api/inventory-counts/${c.id}`)
      setItems(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingItems(false)
    }
  }

  const startCount = async (notes: string) => {
    try {
      await api('/api/inventory-counts', { method: 'POST', body: JSON.stringify({ notes }) })
      toast.success('Yangi inventarizatsiya boshlandi')
      setShowForm(false)
      load()
    } catch (e: any) {
      toast.error(e.message)
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">📋 Inventarizatsiya</h2>
          <p className="text-slate-500 text-sm">Ombor sanashlari</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25"
        >
          + Yangi sanash
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-1 max-h-[70vh] overflow-y-auto custom-scroll">
          {counts.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Sanashlar yo'q</p>
          ) : counts.map(c => (
            <button
              key={c.id}
              onClick={() => openCount(c)}
              className={`w-full text-left p-3 rounded-xl transition-colors ${
                selected?.id === c.id ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">#{c.id.slice(-6)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  c.status === 'completed' ? 'bg-emerald-50 text-emerald-700'
                  : c.status === 'in_progress' ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
                }`}>{c.status}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {formatDateTime(c.startedAt)} • {c._count?.items || 0} ta pozitsiya
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          {!selected ? (
            <div className="text-center text-slate-400 py-12">
              <div className="text-5xl mb-3">👈</div>
              Sanashni tanlang
            </div>
          ) : loadingItems ? (
            <div className="text-center text-slate-400 py-12">Yuklanmoqda...</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-bold text-slate-900">Sanash #{selected.id.slice(-6)}</div>
                  <div className="text-sm text-slate-500">{formatDateTime(selected.startedAt)}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  selected.status === 'completed' ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
                }`}>{selected.status}</span>
              </div>

              {selected.notes && <p className="text-sm text-slate-600 mb-3 italic">📝 {selected.notes}</p>}

              {items.length === 0 ? (
                <p className="text-center text-slate-400 py-8">Pozitsiyalar yo'q</p>
              ) : (
                <div className="space-y-1 max-h-[55vh] overflow-y-auto custom-scroll">
                  {items.map(it => {
                    const actual = it.actualQuantity ?? 0
                    const variance = actual - it.expectedQuantity
                    return (
                      <div key={it.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm">
                        <div className="font-medium text-slate-800">{it.ingredient?.name || '—'}</div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">Kutilgan: {it.expectedQuantity} {it.ingredient?.unit}</span>
                          <span className="text-slate-900">Haqiqiy: {actual} {it.ingredient?.unit}</span>
                          <span className={`font-semibold w-16 text-right ${variance === 0 ? 'text-slate-500' : variance > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {variance > 0 ? '+' : ''}{variance}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showForm && (
        <StartCountForm onClose={() => setShowForm(false)} onStart={startCount} />
      )}
    </div>
  )
}

function StartCountForm({ onClose, onStart }: { onClose: () => void; onStart: (notes: string) => void }) {
  const [notes, setNotes] = useState('')

  return (
    <Modal open onClose={onClose} title="Yangi inventarizatsiya boshlash">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Izoh (ixtiyoriy)</label>
          <textarea className="erp-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Sanash sababi yoki izoh..." />
        </div>
        <p className="text-xs text-slate-500 bg-amber-50 p-3 rounded-lg">
          ⚠️ Boshlangandan so'ng, barcha ingredientlar ro'yxati olinadi va ombor yangilanadi.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={() => onStart(notes)} className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold">
            ✓ Boshlash
          </button>
        </div>
      </div>
    </Modal>
  )
}
