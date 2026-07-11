'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, formatDateTime } from './utils'

type Refund = {
  id: string
  amount: number
  reason: string
  status: string
  createdAt: string
  sale?: { id: string; invoiceNo: string } | null
  processedBy?: { name: string } | null
}

export default function RefundsView() {
  const [items, setItems] = useState<Refund[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/refunds')
      setItems(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalThisMonth = items
    .filter(r => new Date(r.createdAt).getMonth() === new Date().getMonth())
    .reduce((s, r) => s + (r.status === 'approved' ? r.amount : 0), 0)

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
          <h2 className="text-2xl font-bold text-slate-900">↩️ Qaytarib olish (refunds)</h2>
          <p className="text-slate-500 text-sm">
            Bu oy jami: <span className="font-semibold text-amber-600">{formatMoney(totalThisMonth)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold shadow-lg shadow-amber-500/25"
        >
          + Yangi refund
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">↩️</div>
          Refundlar yo'q
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
              <div className="text-2xl">↩️</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {r.sale?.invoiceNo ? `Chek #${r.sale.invoiceNo}` : 'Refund'}
                    </div>
                    <div className="text-sm text-slate-600 mt-1">{r.reason}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-600">{formatMoney(r.amount)}</div>
                    <div className="text-xs text-slate-400 mt-1">{formatDateTime(r.createdAt)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.status === 'approved' ? 'bg-emerald-50 text-emerald-700'
                    : r.status === 'pending' ? 'bg-amber-50 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
                  }`}>{r.status}</span>
                  {r.processedBy && <span className="text-xs text-slate-400">👤 {r.processedBy.name}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <RefundForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}

function RefundForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saleId, setSaleId] = useState('')
  const [amount, setAmount] = useState(0)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!saleId || !amount || !reason) {
      toast.error('Barcha maydonlarni to\'ldiring')
      return
    }
    setSaving(true)
    try {
      await api('/api/refunds', {
        method: 'POST',
        body: JSON.stringify({ saleId, amount, reason })
      })
      toast.success('Refund yaratildi')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Yangi refund">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Sale ID</label>
          <input
            className="erp-input"
            value={saleId}
            onChange={e => setSaleId(e.target.value)}
            placeholder="Sale UUID"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Miqdor (UZS)</label>
          <input
            type="number"
            className="erp-input"
            value={amount || ''}
            onChange={e => setAmount(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Sabab</label>
          <textarea
            className="erp-input"
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Refund sababi..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">
            Bekor
          </button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-amber-500 text-white font-bold disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : '✓ Saqlash'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
