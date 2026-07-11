'use client'

import { useState, useEffect } from 'react'
import { api, toast, Modal, formatDateTime, useConfirm } from './utils'

type ApiToken = {
  id: string
  name: string
  scope: string
  prefix: string
  lastUsedAt: string | null
  createdAt: string
  expiresAt: string | null
  isActive: boolean
}

const SCOPES = [
  { value: 'read', label: 'O\'qish (read)' },
  { value: 'write', label: 'Yozish (write)' },
  { value: 'admin', label: 'Administrator (admin)' }
]

export default function ApiTokensView() {
  const [items, setItems] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const { confirm, dialog } = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/api-tokens')
      setItems(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const revoke = async (t: ApiToken) => {
    if (!(await confirm(`"${t.name}" tokenni bekor qilishni tasdiqlaysizmi? Bu amal qaytarib bo'lmaydi.`))) return
    try {
      await api(`/api/api-tokens/${t.id}`, { method: 'DELETE' })
      toast.success('Token bekor qilindi')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const copyToken = () => {
    if (!newToken) return
    navigator.clipboard.writeText(newToken).then(
      () => toast.success('Token nusxalandi'),
      () => toast.error('Nusxalash amalga oshmadi')
    )
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
          <h2 className="text-2xl font-bold text-slate-900">🔐 API tokenlar</h2>
          <p className="text-slate-500 text-sm">Tashqi ilovalar uchun ruxsat kalitlari</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 text-white font-bold shadow-lg shadow-slate-500/25"
        >
          + Yangi token
        </button>
      </div>

      {newToken && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-amber-900 mb-1">Token muvaffaqiyatli yaratildi!</div>
              <p className="text-sm text-amber-800 mb-3">
                Bu tokeni faqat bir marta ko'rsatamiz. Uni darhol nusxalang va xavfsiz joyda saqlang.
              </p>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm text-slate-800 font-mono break-all">
                  {newToken}
                </code>
                <button
                  onClick={copyToken}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold text-sm whitespace-nowrap"
                >
                  📋 Nusxalash
                </button>
              </div>
              <button
                onClick={() => setNewToken(null)}
                className="mt-3 text-sm text-amber-700 hover:underline font-medium"
              >
                Tushunarli, yopish →
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🔐</div>
          Tokenlar yo'q
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
              <div className="text-2xl">🔑</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900">{t.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    t.scope === 'admin' ? 'bg-red-50 text-red-700'
                    : t.scope === 'write' ? 'bg-amber-50 text-amber-700'
                    : 'bg-blue-50 text-blue-700'
                  }`}>{SCOPES.find(s => s.value === t.scope)?.label || t.scope}</span>
                  {!t.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Nofaol</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <code className="bg-slate-50 px-2 py-0.5 rounded font-mono">{t.prefix}••••••••</code>
                  <span>📅 {formatDateTime(t.createdAt)}</span>
                  {t.lastUsedAt && <span>🔄 Oxirgi: {formatDateTime(t.lastUsedAt)}</span>}
                </div>
              </div>
              <button
                onClick={() => revoke(t)}
                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100"
              >
                Bekor qilish
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TokenForm
          onClose={() => setShowForm(false)}
          onCreated={(token) => { setShowForm(false); setNewToken(token); load() }}
        />
      )}
      {dialog}
    </div>
  )
}

function TokenForm({ onClose, onCreated }: { onClose: () => void; onCreated: (token: string) => void }) {
  const [name, setName] = useState('')
  const [scope, setScope] = useState('read')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name) {
      toast.error('Token nomini kiriting')
      return
    }
    setSaving(true)
    try {
      const res = await api('/api/api-tokens', {
        method: 'POST',
        body: JSON.stringify({ name, scope })
      })
      toast.success('Token yaratildi')
      onCreated(res.token || res.plainToken || '')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Yangi API token">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Token nomi</label>
          <input
            className="erp-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Masalan: Mobile app integration"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Ruxsat darajasi (scope)</label>
          <select className="erp-input" value={scope} onChange={e => setScope(e.target.value)}>
            {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="text-xs text-slate-500 bg-amber-50 p-3 rounded-lg">
          ⚠️ Token faqat bir marta ko'rsatiladi. Uni darhol nusxalang.
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold disabled:opacity-50">
            {saving ? 'Yaratilmoqda...' : '✓ Yaratish'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
