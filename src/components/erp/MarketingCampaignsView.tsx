'use client'

import { useState, useEffect } from 'react'
import { api, toast, Modal, formatDateTime } from './utils'

type Campaign = {
  id: string
  channel: string
  title: string
  message: string
  targetAudience: string
  status: string
  sentCount: number
  createdAt: string
}

const CHANNELS = [
  { value: 'sms', label: 'SMS', icon: '📱' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'push', label: 'Push', icon: '🔔' },
  { value: 'telegram', label: 'Telegram', icon: '✈️' }
]

const AUDIENCES = [
  { value: 'all', label: 'Barcha mijozlar' },
  { value: 'vip', label: 'VIP mijozlar' },
  { value: 'new', label: 'Yangi mijozlar' },
  { value: 'inactive', label: 'Faol bo\'lmagan (30+ kun)' }
]

export default function MarketingCampaignsView() {
  const [items, setItems] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/marketing/campaigns')
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">📣 Marketing kampaniyalari</h2>
          <p className="text-slate-500 text-sm">Mijozlarga xabar yuborish</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold shadow-lg shadow-pink-500/25"
        >
          + Yangi kampaniya
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">📣</div>
          Kampaniyalar yo'q
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(c => {
            const ch = CHANNELS.find(x => x.value === c.channel) || { label: c.channel, icon: '📨' }
            const aud = AUDIENCES.find(x => x.value === c.targetAudience)?.label || c.targetAudience
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{ch.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="font-bold text-slate-900">{c.title}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.status === 'sent' ? 'bg-emerald-50 text-emerald-700'
                          : c.status === 'scheduled' ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                        }`}>{c.status}</span>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">{c.message}</div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span>📡 {ch.label}</span>
                      <span>👥 {aud}</span>
                      {c.sentCount > 0 && <span>✉️ {c.sentCount} yuborildi</span>}
                      <span>🕒 {formatDateTime(c.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <CampaignForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}

function CampaignForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [channel, setChannel] = useState('sms')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetAudience, setTargetAudience] = useState('all')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title || !message) {
      toast.error('Sarlavha va xabar maydonlarini to\'ldiring')
      return
    }
    setSaving(true)
    try {
      await api('/api/marketing/campaigns', {
        method: 'POST',
        body: JSON.stringify({ channel, title, message, targetAudience })
      })
      toast.success('Kampaniya yaratildi')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Yangi marketing kampaniya">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kanal</label>
            <select className="erp-input" value={channel} onChange={e => setChannel(e.target.value)}>
              {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Auditoriya</label>
            <select className="erp-input" value={targetAudience} onChange={e => setTargetAudience(e.target.value)}>
              {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Sarlavha</label>
          <input className="erp-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Aksiyalar va yangiliklar..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Xabar matni</label>
          <textarea
            className="erp-input"
            rows={4}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Xabar matnini kiriting..."
            maxLength={500}
          />
          <div className="text-xs text-slate-400 mt-1 text-right">{message.length}/500</div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-pink-500 text-white font-bold disabled:opacity-50">
            {saving ? 'Yuborilmoqda...' : '✓ Yuborish'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
