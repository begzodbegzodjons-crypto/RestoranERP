'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, formatDateTime } from './utils'

type OnboardingStep = {
  id: string
  title: string
  description?: string
  link?: string
  completed: boolean
}

type OnboardingData = {
  steps: OnboardingStep[]
  progress: number // 0..100
  completed: boolean
  skipped?: boolean
  startedAt?: string
  completedAt?: string | null
}

export default function OnboardingView() {
  const [data, setData] = useState<OnboardingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api<OnboardingData>('/api/onboarding')
      setData(res)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const complete = async () => {
    setBusy(true)
    try {
      const res = await api<OnboardingData>('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify({ action: 'complete' })
      })
      setData(res)
      toast.success('Onboarding yakunlandi! 🎉')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const skip = async () => {
    setBusy(true)
    try {
      const res = await api<OnboardingData>('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify({ action: 'skip' })
      })
      setData(res)
      toast.success('Onboarding o\'tkazib yuborildi')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
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

  if (!data) return null

  const completedCount = data.steps.filter(s => s.completed).length
  const total = data.steps.length
  const isDone = data.completed || data.skipped

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="text-center">
        <div className="text-5xl mb-2">🚀</div>
        <h2 className="text-2xl font-bold text-slate-900">Onboarding</h2>
        <p className="text-slate-500 text-sm">Restoran ERP tizimini sozlash bo\'yicha qadamlar</p>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Umumiy taraqqiyot</span>
          <span className="text-sm font-bold text-emerald-600">
            {completedCount} / {total} ({data.progress}%)
          </span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
            style={{ width: `${data.progress}%` }}
          />
        </div>
        {data.startedAt && (
          <div className="text-xs text-slate-400 mt-2">
            Boshlangan: {formatDateTime(data.startedAt)}
            {data.completedAt && ` • Yakunlangan: ${formatDateTime(data.completedAt)}`}
          </div>
        )}
      </div>

      {isDone && (
        <div className={`rounded-2xl border p-5 ${data.skipped ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{data.skipped ? '⏭️' : '✅'}</span>
            <div>
              <div className="font-bold text-slate-900">
                {data.skipped ? 'Onboarding o\'tkazib yuborildi' : 'Onboarding yakunlandi!'}
              </div>
              <div className="text-sm text-slate-600">
                {data.skipped
                  ? 'Istalgan vaqtda onboardingni qayta boshlashingiz mumkin'
                  : 'Tabriklaymiz! Tizim to\'liq sozlandi'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {data.steps.map((step, idx) => (
            <div key={step.id} className="flex items-start gap-3 p-4 hover:bg-slate-50">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                step.completed
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {step.completed ? '✓' : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold ${step.completed ? 'text-slate-900' : 'text-slate-700'}`}>
                  {step.title}
                </div>
                {step.description && (
                  <div className="text-sm text-slate-500 mt-0.5">{step.description}</div>
                )}
              </div>
              {step.link && (
                <a
                  href={step.link}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
                >
                  Ochiq →
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={complete}
          disabled={busy || data.completed}
          className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 disabled:opacity-50"
        >
          {busy ? 'Ishlanmoqda...' : '✓ Onboardingni yakunlash'}
        </button>
        <button
          onClick={skip}
          disabled={busy}
          className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
        >
          O\'tkazib yuborish
        </button>
      </div>
    </div>
  )
}
