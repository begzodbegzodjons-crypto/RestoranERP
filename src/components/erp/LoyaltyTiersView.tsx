'use client'

import { useState, useEffect } from 'react'
import { api, toast, Modal, useConfirm } from './utils'

type Tier = {
  id: string
  name: string
  minPoints: number
  discountPercent: number
  color: string
  _count?: { customers: number }
}

const COLOR_PRESETS = [
  { value: '#64748b', label: 'Slate' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#06b6d4', label: 'Cyan' }
]

export default function LoyaltyTiersView() {
  const [items, setItems] = useState<Tier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const { confirm, dialog } = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/loyalty/tiers')
      setItems(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const del = async (t: Tier) => {
    if (!(await confirm(`"${t.name}" darajasini o'chirishni tasdiqlaysizmi?`))) return
    try {
      await api(`/api/loyalty/tiers/${t.id}`, { method: 'DELETE' })
      toast.success('O\'chirildi')
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
          <h2 className="text-2xl font-bold text-slate-900">🏆 Sodiqlik darajalari</h2>
          <p className="text-slate-500 text-sm">Mijozlar uchun bonus tizimi</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold shadow-lg shadow-purple-500/25"
        >
          + Yangi daraja
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🏆</div>
          Darajalar yo'q
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items
            .slice()
            .sort((a, b) => a.minPoints - b.minPoints)
            .map(t => (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 relative overflow-hidden"
                style={{ borderTopColor: t.color, borderTopWidth: 4 }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-lg text-slate-900 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: t.color }} />
                      {t.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {t._count?.customers || 0} ta mijoz
                    </div>
                  </div>
                  <button onClick={() => del(t)} className="text-slate-300 hover:text-red-500 text-lg">×</button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="text-xs text-slate-500">Min. ball</div>
                    <div className="font-bold text-slate-900">{t.minPoints}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2.5">
                    <div className="text-xs text-emerald-700">Chegirma</div>
                    <div className="font-bold text-emerald-700">{t.discountPercent}%</div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {showForm && (
        <TierForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />
      )}
      {dialog}
    </div>
  )
}

function TierForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [minPoints, setMinPoints] = useState(0)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [color, setColor] = useState('#64748b')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name) {
      toast.error('Nom kiriting')
      return
    }
    setSaving(true)
    try {
      await api('/api/loyalty/tiers', {
        method: 'POST',
        body: JSON.stringify({ name, minPoints, discountPercent, color })
      })
      toast.success('Daraja yaratildi')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Yangi sodiqlik darajasi">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nomi</label>
          <input className="erp-input" value={name} onChange={e => setName(e.target.value)} placeholder="VIP, Gold, Silver..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Min. ball</label>
            <input type="number" className="erp-input" value={minPoints || ''} onChange={e => setMinPoints(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Chegirma (%)</label>
            <input type="number" className="erp-input" value={discountPercent || ''} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Rang</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                className={`w-9 h-9 rounded-full border-2 ${color === c.value ? 'border-slate-900 scale-110' : 'border-transparent'} transition-all`}
                style={{ background: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-purple-500 text-white font-bold disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : '✓ Saqlash'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
