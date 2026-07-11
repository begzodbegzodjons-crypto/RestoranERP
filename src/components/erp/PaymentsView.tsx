'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, formatDateTime } from './utils'

type ProviderConfig = {
  configured: boolean
  merchantId?: string
  active?: boolean
}

type StatusData = {
  click?: ProviderConfig
  payme?: ProviderConfig
}

type PayResponse = {
  paymentUrl?: string
  redirectUrl?: string
  transactionId?: string
  status?: string
}

const PROVIDERS = [
  {
    key: 'click' as const,
    name: 'Click',
    icon: '🔵',
    color: 'from-blue-500 to-indigo-600',
    accent: 'bg-blue-50 text-blue-700 border-blue-200',
    endpoint: '/api/payments/click'
  },
  {
    key: 'payme' as const,
    name: 'Payme',
    icon: '🟢',
    color: 'from-emerald-500 to-teal-600',
    accent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    endpoint: '/api/payments/payme'
  }
]

export default function PaymentsView() {
  const [status, setStatus] = useState<StatusData>({})
  const [loading, setLoading] = useState(true)
  const [amounts, setAmounts] = useState<Record<string, string>>({ click: '', payme: '' })
  const [descriptions, setDescriptions] = useState<Record<string, string>>({ click: '', payme: '' })
  const [paying, setPaying] = useState<Record<string, boolean>>({ click: false, payme: false })

  const load = async () => {
    setLoading(true)
    try {
      const res = await api<StatusData>('/api/payments/status')
      setStatus(res)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const pay = async (key: 'click' | 'payme') => {
    const amount = parseFloat(amounts[key] || '0')
    if (!amount || amount <= 0) {
      toast.error('Miqdorni kiriting')
      return
    }
    const provider = PROVIDERS.find(p => p.key === key)!
    setPaying(p => ({ ...p, [key]: true }))
    try {
      const res = await api<PayResponse>(provider.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          description: descriptions[key] || `To'lov (${provider.name})`
        })
      })
      const url = res.paymentUrl || res.redirectUrl
      if (url) {
        toast.success(`${provider.name} to'lov sahifasiga yo'naltirilmoqda...`)
        setTimeout(() => { window.location.href = url }, 800)
      } else {
        toast.success(`To'lov yaratildi: ${res.transactionId || res.status || 'OK'}`)
      }
      setAmounts(p => ({ ...p, [key]: '' }))
      setDescriptions(p => ({ ...p, [key]: '' }))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPaying(p => ({ ...p, [key]: false }))
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
      <div>
        <h2 className="text-2xl font-bold text-slate-900">💳 To\'lov tizimlari</h2>
        <p className="text-slate-500 text-sm">Click va Payme orqali to\'lovlarni boshqaring</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map(provider => {
          const cfg = status[provider.key]
          const configured = cfg?.configured || cfg?.active
          const amount = amounts[provider.key]
          const desc = descriptions[provider.key]
          const isPaying = paying[provider.key]
          return (
            <div key={provider.key} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className={`p-5 bg-gradient-to-r ${provider.color} text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{provider.icon}</span>
                    <div>
                      <div className="text-xl font-bold">{provider.name}</div>
                      {cfg?.merchantId && (
                        <div className="text-xs opacity-90 font-mono">ID: {cfg.merchantId}</div>
                      )}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    configured ? 'bg-white/25 text-white' : 'bg-white/15 text-white/80'
                  }`}>
                    {configured ? '● Faol' : '○ Sozlanmagan'}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-3">
                <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  configured
                    ? provider.accent
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {configured
                    ? `✓ ${provider.name} to'lov tizimi sozlangan va faol`
                    : `⚠ ${provider.name} hozircha sozlanmagan. Admin panelda sozlang.`}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">To'lov miqdori (UZS)</label>
                  <input
                    type="number"
                    className="erp-input"
                    placeholder="0"
                    value={amount}
                    disabled={!configured}
                    onChange={e => setAmounts(p => ({ ...p, [provider.key]: e.target.value }))}
                  />
                  {amount && parseFloat(amount) > 0 && (
                    <div className="text-xs text-slate-500 mt-1">
                      {formatMoney(parseFloat(amount))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Izoh (ixtiyoriy)</label>
                  <input
                    type="text"
                    className="erp-input"
                    placeholder={`Masalan: Buyurtma #1234`}
                    value={desc}
                    disabled={!configured}
                    onChange={e => setDescriptions(p => ({ ...p, [provider.key]: e.target.value }))}
                  />
                </div>

                <button
                  onClick={() => pay(provider.key)}
                  disabled={!configured || isPaying}
                  className={`w-full px-4 py-3 rounded-xl text-white font-bold shadow-lg transition-opacity disabled:opacity-50 bg-gradient-to-r ${provider.color}`}
                >
                  {isPaying ? 'Ishlanmoqda...' : `To'lash (${provider.name})`}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900 mb-2">ℹ️ Ma\'lumot</h3>
        <ul className="text-sm text-slate-600 space-y-1.5">
          <li>• To\'lov tizimlari admin panelda sozlanadi (merchant ID, kalitlar).</li>
          <li>• To\'lov miqdori UZS da kiritiladi va tizimga yuboriladi.</li>
          <li>• To\'lash tugmasi bosilganda siz to\'lov provayderi sahifasiga yo\'naltirilasiz.</li>
          <li>• To\'lov muvaffaqiyatli yakunlangach, tranzaksiya avtomatik tasdiqlanadi.</li>
        </ul>
      </div>
    </div>
  )
}
