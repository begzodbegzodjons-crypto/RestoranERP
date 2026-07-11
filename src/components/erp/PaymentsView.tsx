'use client'
import { useState, useEffect } from 'react'
import { api, toast, formatMoney } from './utils'

type ProviderConfig = {
  configured: boolean
  merchantId?: string
  instructions?: string
}

export default function PaymentsView() {
  const [paymeConfig, setPaymeConfig] = useState<ProviderConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [paying, setPaying] = useState(false)
  const [lastPayment, setLastPayment] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/payments/payme')
      setPaymeConfig(res)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const pay = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt < 100) {
      toast.error('Minimal to\'lov 100 so\'m')
      return
    }

    setPaying(true)
    try {
      const res = await api('/api/payments/payme', {
        method: 'POST',
        body: JSON.stringify({ amount: amt, description })
      })

      if (res.paymentUrl) {
        setLastPayment(res)
        toast.success('To\'lov havolasi yaratildi. Payme ga yo\'naltirilmoqda...')
        setTimeout(() => {
          window.open(res.paymentUrl, '_blank')
        }, 1000)
      } else {
        toast.error('To\'lov havolasi olinmadi')
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        <p className="mt-2 text-slate-400">Yuklanmoqda...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">💳 To'lov tizimlari</h2>
        <p className="text-slate-500 text-sm mt-1">Payme orqali to'lovlarni boshqaring</p>
      </div>

      {/* Payme kartochkasi */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">💳 Payme</h3>
              <p className="text-emerald-50 text-sm mt-1">O'zbekiston to'lov tizimi</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              paymeConfig?.configured ? 'bg-white text-emerald-700' : 'bg-amber-400 text-amber-900'
            }`}>
              {paymeConfig?.configured ? '✓ Faol' : '⚠ Sozlanmagan'}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {paymeConfig?.configured ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  To'lov summasi (so'm) *
                </label>
                <input
                  type="number"
                  className="erp-input"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Masalan: 50000"
                  min="100"
                />
                <p className="text-xs text-slate-500 mt-1">Minimal: 100 so'm</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Izoh (ixtiyoriy)
                </label>
                <input
                  type="text"
                  className="erp-input"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Masalan: Obuna to'lovi"
                />
              </div>

              <button
                onClick={pay}
                disabled={paying}
                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 disabled:opacity-50"
              >
                {paying ? '⏳ To\'lov yaratilmoqda...' : '💳 Payme orqali to\'lash'}
              </button>

              {lastPayment && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="font-semibold text-emerald-900 mb-1">✅ To'lov yaratildi!</div>
                  <div className="text-sm text-emerald-800">
                    <div>Order ID: <code className="bg-white px-2 py-0.5 rounded">{lastPayment.orderId}</code></div>
                    <div>Summa: <strong>{formatMoney(lastPayment.amount)}</strong></div>
                  </div>
                  <a
                    href={lastPayment.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold text-sm"
                  >
                    Payme ga o'tish →
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="font-semibold text-amber-900 mb-2">⚠ Payme sozlanmagan</div>
              <p className="text-sm text-amber-800 mb-2">
                Payme to'lov tizimini sozlash uchun:
              </p>
              <ol className="text-sm text-amber-700 list-decimal list-inside space-y-1">
                <li>Payme.uz da merchant akkaunt oching</li>
                <li>Merchant ID va Key oling</li>
                <li>Cloudflare env variableslarga qo'shing:
                  <code className="block bg-white px-2 py-1 rounded mt-1 text-xs">PAYME_MERCHANT_ID=xxx<br/>PAYME_KEY=xxx</code>
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="text-sm text-blue-900">
          💡 <strong>Eslatma:</strong> Payme to'lov tizimi orqali foydalanuvchilar obuna to'lovlarini amalga oshirishlari mumkin.
          To'lovlar avtomatik tarzda qayd qilinadi va admin panelida ko'rinadi.
        </div>
      </div>
    </div>
  )
}
