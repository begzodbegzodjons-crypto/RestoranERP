'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, formatDateTime, formatNumber } from './utils'

type Waste = {
  id: string
  type: string
  quantity: number
  unit: string
  cost: number
  reason: string
  createdAt: string
  ingredient?: { id: string; name: string } | null
  recordedBy?: { name: string } | null
}

type Ingredient = { id: string; name: string; unit: string }

const WASTE_TYPES = [
  { value: 'spoilage', label: 'Buzilgan (spoilage)' },
  { value: 'expired', label: 'Muddati o\'tgan' },
  { value: 'damaged', label: 'Shikastlangan' },
  { value: 'overportion', label: 'Ortiqcha poritsiya' },
  { value: 'other', label: 'Boshqa' }
]

export default function WastesView() {
  const [items, setItems] = useState<Waste[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/wastes')
      setItems(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalCost = items.reduce((s, w) => s + w.cost, 0)

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
          <h2 className="text-2xl font-bold text-slate-900">🗑️ Brak va isrof</h2>
          <p className="text-slate-500 text-sm">
            Jami zarar: <span className="font-semibold text-red-600">{formatMoney(totalCost)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold shadow-lg shadow-red-500/25"
        >
          + Yangi brak
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🗑️</div>
          Brak yozuvlari yo'q
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(w => (
            <div key={w.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
              <div className="text-2xl">🗑️</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {w.ingredient?.name || 'Noma\'lum ingredient'}
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {formatNumber(w.quantity)} {w.unit} • {w.reason}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-600">-{formatMoney(w.cost)}</div>
                    <div className="text-xs text-slate-400 mt-1">{formatDateTime(w.createdAt)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">
                    {WASTE_TYPES.find(t => t.value === w.type)?.label || w.type}
                  </span>
                  {w.recordedBy && <span className="text-xs text-slate-400">👤 {w.recordedBy.name}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <WasteForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}

function WasteForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [ingredientId, setIngredientId] = useState('')
  const [type, setType] = useState('spoilage')
  const [quantity, setQuantity] = useState(0)
  const [unit, setUnit] = useState('')
  const [cost, setCost] = useState(0)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api('/api/ingredients').then(res => setIngredients(res.items || [])).catch(() => {})
  }, [])

  const selectIngredient = (id: string) => {
    const ing = ingredients.find(i => i.id === id)
    setIngredientId(id)
    if (ing) setUnit(ing.unit)
  }

  const save = async () => {
    if (!ingredientId || !quantity || !reason) {
      toast.error('Barcha majburiy maydonlarni to\'ldiring')
      return
    }
    setSaving(true)
    try {
      await api('/api/wastes', {
        method: 'POST',
        body: JSON.stringify({ ingredientId, type, quantity, unit, cost, reason })
      })
      toast.success('Brak yozuvi qo\'shildi')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Yangi brak yozuvi">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Ingredient</label>
          <select className="erp-input" value={ingredientId} onChange={e => selectIngredient(e.target.value)}>
            <option value="">Tanlang...</option>
            {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Turi</label>
            <select className="erp-input" value={type} onChange={e => setType(e.target.value)}>
              {WASTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Birlik</label>
            <input className="erp-input" value={unit} onChange={e => setUnit(e.target.value)} placeholder="kg, dona..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Miqdor</label>
            <input type="number" className="erp-input" value={quantity || ''} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Zarar (UZS)</label>
            <input type="number" className="erp-input" value={cost || ''} onChange={e => setCost(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Sabab</label>
          <textarea className="erp-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Brak sababi..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-red-500 text-white font-bold disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : '✓ Saqlash'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
