'use client'

import { useState } from 'react'
import { api, toast } from './utils'

export default function BlockedScreen({
  restaurantName,
  trialEnd,
  onActivated,
  onLogout
}: {
  restaurantName: string
  trialEnd: string
  onActivated: () => void
  onLogout: () => void
}) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const activate = async () => {
    if (!code) {
      toast.error('Aktivatsiya kodini kiriting')
      return
    }
    setLoading(true)
    try {
      const res = await api('/api/activation/activate', {
        method: 'POST',
        body: JSON.stringify({ code })
      })
      toast.success(res.message)
      onActivated()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-red-900 p-4 relative overflow-hidden">
      {/* Aurora blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="aurora-blob absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full bg-red-500/20 blur-3xl"></div>
        <div className="aurora-blob absolute -bottom-40 -right-40 w-[40rem] h-[40rem] rounded-full bg-orange-500/15 blur-3xl" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 sm:p-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-xl shadow-red-500/30 mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-white">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Dastur bloklangan</h1>
          <p className="text-slate-600">
            Hurmatli <span className="font-semibold text-slate-900">{restaurantName}</span>, sinov muddati tugagan.
          </p>
          <p className="text-sm text-slate-500 mt-1">Sinov muddati: {new Date(trialEnd).toLocaleDateString('uz-UZ')}</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <div className="font-bold text-amber-900 mb-1">Dasturni faollashtirish</div>
              <p className="text-sm text-amber-800 mb-3">
                Faollashtirish uchun 30 kunlik aktivatsiya kodini kiriting. Kod uchun murojaat:
              </p>
              <a
                href="https://t.me/norinkomp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors text-sm"
              >
                💬 Telegram: @norinkomp
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-2">Aktivatsiya kodi (8 raqam)</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{8}"
              maxLength={8}
              className="erp-input text-center text-3xl font-mono font-bold tracking-[0.5em]"
              placeholder="••••••••"
              value={code}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                setCode(v)
              }}
              onKeyDown={e => e.key === 'Enter' && activate()}
            />
            <p className="text-xs text-slate-500 mt-2 text-center">
              Kod 8 ta raqamdan iborat. Har bir kod faqat 1 marta ishlatiladi.
            </p>
          </div>

          <button
            onClick={activate}
            disabled={loading || code.length !== 8}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Faollashtirilmoqda...' : '✓ Dasturni faollashtirish'}
          </button>

          <button
            onClick={onLogout}
            className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium"
          >
            Boshqa akkauntga kirish
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Faollashtirilgandan so'ng dastur 30 kun davomida to'liq ishlaydi.
          </p>
        </div>
      </div>
    </div>
  )
}
