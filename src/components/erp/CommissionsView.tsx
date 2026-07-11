'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, formatDateTime } from './utils'

type Staff = { id: string; name: string; role: string; phone: string | null }

type Commission = {
  id: string
  type: string
  amount: number
  description: string | null
  createdAt: string
}

const COMMISSION_TYPES = [
  { value: 'commission', label: 'Komissiya', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'tip', label: 'Choy puli', color: 'bg-blue-50 text-blue-700' },
  { value: 'bonus', label: 'Bonus', color: 'bg-purple-50 text-purple-700' },
  { value: 'penalty', label: 'Jarima', color: 'bg-red-50 text-red-700' }
]

export default function CommissionsView() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [selected, setSelected] = useState<Staff | null>(null)
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingComms, setLoadingComms] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/staff')
      setStaff(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const loadCommissions = async (s: Staff) => {
    setSelected(s)
    setLoadingComms(true)
    try {
      const res = await api(`/api/staff/${s.id}/commissions`)
      setCommissions(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingComms(false)
    }
  }

  const total = commissions.reduce((sum, c) => sum + (c.type === 'penalty' ? -c.amount : c.amount), 0)

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
      <div>
        <h2 className="text-2xl font-bold text-slate-900">💰 Komissiyalar va bonuslar</h2>
        <p className="text-slate-500 text-sm">Xodimni tanlang va komissiyalarni ko'ring</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-1 max-h-[70vh] overflow-y-auto custom-scroll">
          <div className="text-xs font-semibold text-slate-500 uppercase px-2 py-1">Xodimlar ({staff.length})</div>
          {staff.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Xodimlar yo'q</p>
          ) : staff.map(s => (
            <button
              key={s.id}
              onClick={() => loadCommissions(s)}
              className={`w-full text-left p-3 rounded-xl transition-colors ${
                selected?.id === s.id ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'
              }`}
            >
              <div className="font-medium text-slate-900">👤 {s.name}</div>
              <div className="text-xs text-slate-500">{s.role}</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          {!selected ? (
            <div className="text-center text-slate-400 py-12">
              <div className="text-5xl mb-3">👈</div>
              Xodimni tanlang
            </div>
          ) : loadingComms ? (
            <div className="text-center text-slate-400 py-12">Yuklanmoqda...</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-bold text-slate-900 text-lg">{selected.name}</div>
                  <div className="text-sm text-slate-500">{selected.role}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Jami balans</div>
                  <div className={`font-bold ${total >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(total)}</div>
                </div>
              </div>

              <button
                onClick={() => setShowForm(true)}
                className="w-full mb-3 px-4 py-2 rounded-xl bg-emerald-500 text-white font-semibold text-sm"
              >
                + Yangi yozuv
              </button>

              {commissions.length === 0 ? (
                <p className="text-center text-slate-400 py-8">Yozuvlar yo'q</p>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scroll">
                  {commissions.map(c => {
                    const meta = COMMISSION_TYPES.find(t => t.value === c.type) || { label: c.type, color: 'bg-slate-100 text-slate-700' }
                    return (
                      <div key={c.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-xl">
                        <div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                          {c.description && <div className="text-sm text-slate-700 mt-1">{c.description}</div>}
                          <div className="text-xs text-slate-400 mt-1">{formatDateTime(c.createdAt)}</div>
                        </div>
                        <div className={`font-bold ${c.type === 'penalty' ? 'text-red-600' : 'text-emerald-600'}`}>
                          {c.type === 'penalty' ? '-' : '+'}{formatMoney(c.amount)}
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

      {showForm && selected && (
        <CommissionForm
          staff={selected}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadCommissions(selected) }}
        />
      )}
    </div>
  )
}

function CommissionForm({ staff, onClose, onSaved }: { staff: Staff; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState('commission')
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!amount) {
      toast.error('Miqdorni kiriting')
      return
    }
    setSaving(true)
    try {
      await api(`/api/staff/${staff.id}/commissions`, {
        method: 'POST',
        body: JSON.stringify({ type, amount, description })
      })
      toast.success('Yozuv qo\'shildi')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${staff.name} — yangi yozuv`}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Turi</label>
          <select className="erp-input" value={type} onChange={e => setType(e.target.value)}>
            {COMMISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Miqdor (UZS)</label>
          <input type="number" className="erp-input" value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Izoh</label>
          <textarea className="erp-input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Izoh..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : '✓ Saqlash'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
