'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, toast } from './utils'

export default function AuthPage({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', address: ''
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'register') {
        await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(form)
        })
        toast.success('Muvaffaqiyatli ro\'yxatdan o\'tdingiz! 10 kunlik bepul sinov boshlandi.')
      } else {
        await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, password: form.password })
        })
        toast.success('Xush kelibsiz!')
      }
      onAuthed()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-stretch bg-gradient-to-br from-emerald-50 via-white to-teal-50 relative overflow-hidden">
      {/* Aurora blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="aurora-blob absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full bg-emerald-300/30 blur-3xl"></div>
        <div className="aurora-blob absolute top-1/2 -right-40 w-[35rem] h-[35rem] rounded-full bg-teal-300/25 blur-3xl" style={{ animationDelay: '4s' }}></div>
        <div className="aurora-blob absolute -bottom-40 left-1/3 w-[30rem] h-[30rem] rounded-full bg-cyan-200/20 blur-3xl" style={{ animationDelay: '8s' }}></div>
      </div>

      <div className="relative z-10 w-full grid lg:grid-cols-2 items-stretch">
        {/* Left side - branding */}
        <div className="hidden lg:flex flex-col gap-7 p-12 xl:p-16 2xl:p-20 justify-center">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-white">
                <path d="M3 11h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M5 11v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6M9 3v2M15 3v2" />
                <circle cx="9" cy="15" r="1" />
                <circle cx="15" cy="15" r="1" />
              </svg>
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight">OshxonaERP</div>
              <div className="text-base text-emerald-600 font-medium">ERP • CRM • POS Tizimi</div>
            </div>
          </div>

          <h1 className="text-5xl xl:text-6xl 2xl:text-7xl font-bold leading-tight tracking-tight">
            <span className="hero-shimmer-wrapper">
              <span className="hero-shimmer">Restoraningizni bir tizimda boshqaring</span>
            </span>
          </h1>

          <p className="text-muted-foreground text-xl leading-relaxed">
            Retseptlar, ombor mahsulotlari, har bir taomning tayyorlash va sotilish narxlari avtomatik hisoblanadi.
            Savdo, chiqim, foyda va ombor qoldig'i — barchasi real vaqtda yangilanadi.
          </p>

          <div className="grid grid-cols-2 gap-5 mt-2">
            {[
              { icon: '🍳', title: 'Retsept boshqaruvi' },
              { icon: '📦', title: 'Ombor avtomatikasi' },
              { icon: '💰', title: 'POS kassa' },
              { icon: '📊', title: 'Foyda hisoboti' }
            ].map(f => (
              <div key={f.title} className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/70 border border-emerald-100 backdrop-blur">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl">{f.icon}</div>
                <span className="text-base font-medium">{f.title}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 p-6 rounded-2xl bg-emerald-50/80 border border-emerald-200">
            <div className="text-base text-emerald-700 font-bold mb-2 tracking-wide">BEPUL SINOV</div>
            <div className="text-lg text-emerald-900 leading-relaxed">
              10 kun davomida barcha funksiyalar bilan bepul foydalaning. Karta talab qilinmaydi.
            </div>
          </div>
        </div>

        {/* Right side - form */}
        <div className="w-full flex items-center justify-center p-6 sm:p-10 lg:p-12 xl:p-16 2xl:p-20">
          <div className="glass rounded-3xl shadow-2xl shadow-emerald-900/10 border border-emerald-100/50 p-8 sm:p-10 lg:p-10 xl:p-12 w-full max-w-2xl">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-white">
                  <path d="M3 11h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M5 11v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6M9 3v2M15 3v2" />
                  <circle cx="9" cy="15" r="1" />
                  <circle cx="15" cy="15" r="1" />
                </svg>
              </div>
              <div className="text-2xl font-bold">OshxonaERP</div>
            </div>

            {/* Tabs */}
            <div className="flex p-1.5 bg-muted rounded-2xl mb-8">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-3.5 text-lg font-semibold rounded-xl transition-all ${mode === 'login' ? 'bg-white text-emerald-700 shadow' : 'text-muted-foreground'}`}
              >
                Tizimga kirish
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-3.5 text-lg font-semibold rounded-xl transition-all ${mode === 'register' ? 'bg-white text-emerald-700 shadow' : 'text-muted-foreground'}`}
              >
                Ro'yxatdan o'tish
              </button>
            </div>

            <form className="space-y-5" onSubmit={submit}>
              {mode === 'register' && (
                <div>
                  <label className="block font-semibold text-foreground mb-1.5 text-base">Restoran nomi</label>
                  <input
                    required
                    className="erp-input"
                    placeholder="Mening restoranim"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-foreground mb-1.5 text-base">Email</label>
                <input
                  required
                  type="email"
                  className="erp-input"
                  placeholder="restoran@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1.5 text-base">Parol</label>
                <input
                  required
                  type="password"
                  className="erp-input"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>

              {mode === 'register' && (
                <>
                  <div>
                    <label className="block font-semibold text-foreground mb-1.5 text-base">Telefon</label>
                    <input
                      className="erp-input"
                      placeholder="+998 90 123 45 67"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-foreground mb-1.5 text-base">Manzil</label>
                    <input
                      className="erp-input"
                      placeholder="Toshkent, Chilonzor..."
                      value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 text-lg rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Iltimos kuting...
                  </>
                ) : mode === 'register' ? 'Ro\'yxatdan o\'tish' : 'Kirish'}
              </button>

              <div className="text-center text-sm text-muted-foreground">
                Yordam kerakmi? Telegram: <a href="https://t.me/norinkomp" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-semibold hover:underline">@norinkomp</a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
