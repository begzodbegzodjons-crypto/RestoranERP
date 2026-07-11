'use client'

import { useState, useEffect } from 'react'
import { api, toast, Modal, formatDateTime, formatNumber } from './utils'

type AbTest = {
  id: string
  name: string
  testType: string
  variantA: string
  variantB: string
  status: string
  variantACount: number
  variantBCount: number
  variantAConversion: number
  variantBConversion: number
  winner: string | null
  createdAt: string
  endedAt: string | null
}

const TEST_TYPES = [
  { value: 'price', label: 'Narx testi' },
  { value: 'title', label: 'Sarlavha testi' },
  { value: 'image', label: 'Rasm testi' },
  { value: 'description', label: 'Tavsif testi' },
  { value: 'layout', label: 'Joylash testi' },
  { value: 'promotion', label: 'Aksiya testi' }
]

export default function AbTestsView() {
  const [items, setItems] = useState<AbTest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/ab-tests')
      setItems(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const endTest = async (t: AbTest) => {
    try {
      await api(`/api/ab-tests/${t.id}/end`, { method: 'POST' })
      toast.success('Test yakunlandi')
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
          <h2 className="text-2xl font-bold text-slate-900">🧪 A/B testlar</h2>
          <p className="text-slate-500 text-sm">Marketing va mahsulot testlari</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-lg shadow-indigo-500/25"
        >
          + Yangi test
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🧪</div>
          Testlar yo'q
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(t => {
            const isRunning = t.status === 'running'
            const aWins = (t.variantAConversion || 0) > (t.variantBConversion || 0)
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <div className="font-bold text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {TEST_TYPES.find(x => x.value === t.testType)?.label || t.testType} • {formatDateTime(t.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isRunning ? 'bg-emerald-50 text-emerald-700'
                      : t.status === 'completed' ? 'bg-slate-100 text-slate-700'
                      : 'bg-amber-50 text-amber-700'
                    }`}>{t.status}</span>
                    {isRunning && (
                      <button
                        onClick={() => endTest(t)}
                        className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-700 font-medium hover:bg-red-100"
                      >
                        Yakunlash
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'A', val: t.variantA, count: t.variantACount, conv: t.variantAConversion, win: aWins && t.status === 'completed' },
                    { label: 'B', val: t.variantB, count: t.variantBCount, conv: t.variantBConversion, win: !aWins && t.status === 'completed' }
                  ].map(v => (
                    <div
                      key={v.label}
                      className={`rounded-xl p-3 border-2 ${
                        v.win ? 'border-emerald-300 bg-emerald-50'
                        : v.label === 'A' ? 'border-blue-200 bg-blue-50'
                        : 'border-purple-200 bg-purple-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">
                          Variant {v.label}
                          {v.win && <span className="ml-1">🏆</span>}
                        </span>
                        <span className="text-xs text-slate-600">{v.count} ishtirokchi</span>
                      </div>
                      <div className="text-sm text-slate-700 mb-1">{v.val}</div>
                      <div className="text-xs text-slate-500">Konversiya: {formatNumber(v.conv || 0)}%</div>
                    </div>
                  ))}
                </div>

                {t.winner && t.status === 'completed' && (
                  <div className="mt-3 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-2 text-center">
                    ✓ G'olib: Variant {t.winner}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <AbTestForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}

function AbTestForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [testType, setTestType] = useState('price')
  const [variantA, setVariantA] = useState('')
  const [variantB, setVariantB] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name || !variantA || !variantB) {
      toast.error('Barcha maydonlarni to\'ldiring')
      return
    }
    setSaving(true)
    try {
      await api('/api/ab-tests', {
        method: 'POST',
        body: JSON.stringify({ name, testType, variantA, variantB })
      })
      toast.success('A/B test yaratildi')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Yangi A/B test">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Test nomi</label>
          <input className="erp-input" value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: Lavash narx testi" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Test turi</label>
          <select className="erp-input" value={testType} onChange={e => setTestType(e.target.value)}>
            {TEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Variant A</label>
            <input className="erp-input" value={variantA} onChange={e => setVariantA(e.target.value)} placeholder="Boshlang'ich qiymat" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Variant B</label>
            <input className="erp-input" value={variantB} onChange={e => setVariantB(e.target.value)} placeholder="Test qiymati" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-indigo-500 text-white font-bold disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : '✓ Boshlash'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
