'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatMoney, formatDateTime } from '../erp/utils'

type Code = {
  id: string
  code: string
  status: string
  validDays: number
  createdAt: string
  usedAt: string | null
  expiresAt: string | null
  usedBy: string | null
  usedByRestaurant: string | null
}

type Restaurant = {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  status: string
  trialStart: string
  trialEnd: string
  activatedAt: string | null
  activationEnd: string | null
  activationCode: string | null
  createdAt: string
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'login' | 'panel'>('login')
  const [password, setPassword] = useState('')
  const [tab, setTab] = useState<'codes' | 'restaurants'>('codes')
  const [codes, setCodes] = useState<Code[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(false)
  const [genCount, setGenCount] = useState(1)
  const [genDays, setGenDays] = useState(30)
  const [recentlyGenerated, setRecentlyGenerated] = useState<Code[]>([])

  // Check existing session on mount
  useEffect(() => {
    fetch('/api/admin/login').then(r => {
      if (r.ok) setStep('panel')
    }).catch(() => {})
  }, [])

  const login = async () => {
    setLoading(true)
    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password })
      })
      setStep('panel')
      toast.success('Admin kabinetga xush kelibsiz')
      loadData()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    try {
      const [codesRes, restRes] = await Promise.all([
        api('/api/admin/codes'),
        api('/api/admin/restaurants')
      ])
      setCodes(codesRes.codes || [])
      setRestaurants(restRes.restaurants || [])
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  useEffect(() => {
    if (step === 'panel') loadData()
  }, [step])

  const generateCodes = async () => {
    setLoading(true)
    try {
      const res = await api('/api/admin/codes', {
        method: 'POST',
        body: JSON.stringify({ count: genCount, validDays: genDays })
      })
      setRecentlyGenerated(res.codes)
      toast.success(`${res.codes.length} ta aktivatsiya kodi generatsiya qilindi`)
      loadData()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Kod nusxalandi: ' + code)
  }

  const logout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' })
    setStep('login')
    setPassword('')
    onClose()
  }

  // Login screen
  if (step === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30 mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-9 h-9 text-white">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Maxfiy Kabinet</h1>
            <p className="text-emerald-200/70 mt-2">Faqat sayt egasi uchun</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-emerald-100 font-semibold mb-2 text-sm">Maxfiy kalit</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-emerald-200/50 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
                placeholder="••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
              />
            </div>

            <button
              onClick={login}
              disabled={loading || !password}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all disabled:opacity-50"
            >
              {loading ? 'Tekshirilmoqda...' : 'Kirish'}
            </button>

            <button
              onClick={onClose}
              className="w-full py-2 text-emerald-200/70 hover:text-white text-sm font-medium"
            >
              ← Bosh sahifaga qaytish
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Admin panel
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-slate-900">Maxfiy Admin Panel</div>
              <div className="text-xs text-slate-500">Sayt egasi kabineti</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors text-sm"
            >
              ↻ Yangilash
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors text-sm"
            >
              Chiqish
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
          <button
            onClick={() => setTab('codes')}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-colors ${tab === 'codes' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            🔑 Aktivatsiya kodlari
          </button>
          <button
            onClick={() => setTab('restaurants')}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-colors ${tab === 'restaurants' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            🏪 Restoranlar
          </button>
        </div>

        {tab === 'codes' && (
          <div className="space-y-6">
            {/* Generator */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Yangi aktivatsiya kodi generatsiya qilish</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Miqdor</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={genCount}
                    onChange={e => setGenCount(parseInt(e.target.value) || 1)}
                    className="erp-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Amal qilish muddati (kun)</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={genDays}
                    onChange={e => setGenDays(parseInt(e.target.value) || 30)}
                    className="erp-input"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={generateCodes}
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Generatsiya...' : '🔑 Kod generatsiya qilish'}
                  </button>
                </div>
              </div>

              {recentlyGenerated.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-sm font-bold text-emerald-900 mb-2">✓ Generatsiya qilingan kodlar (foydalanuvchiga yuboring):</div>
                  <div className="space-y-2">
                    {recentlyGenerated.map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                        <code className="text-2xl font-mono font-bold tracking-widest text-emerald-700">{c.code}</code>
                        <button
                          onClick={() => copyCode(c.code)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium hover:bg-emerald-200"
                        >
                          📋 Nusxalash
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-emerald-700 mt-2">
                    ⚠️ Har bir kod faqat 1 marta, faqat 1 ta restoran uchun ishlatiladi. {genDays} kun amal qiladi.
                  </p>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="text-sm text-slate-500 mb-1">Jami kodlar</div>
                <div className="text-3xl font-bold text-slate-900">{codes.length}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="text-sm text-slate-500 mb-1">Ishlatilmagan</div>
                <div className="text-3xl font-bold text-emerald-600">{codes.filter(c => c.status === 'unused').length}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="text-sm text-slate-500 mb-1">Ishlatilgan</div>
                <div className="text-3xl font-bold text-slate-500">{codes.filter(c => c.status === 'used').length}</div>
              </div>
            </div>

            {/* Codes list */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">Barcha aktivatsiya kodlari</h3>
              </div>
              <div className="max-h-[600px] overflow-y-auto custom-scroll">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Kod</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Holat</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Muddat</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Yaratilgan</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Ishlatilgan</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Restoran</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {codes.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">Hozircha kodlar yo'q</td>
                      </tr>
                    )}
                    {codes.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3">
                          <code className={`text-lg font-mono font-bold tracking-wider ${c.status === 'used' ? 'text-slate-400' : 'text-emerald-700'}`}>
                            {c.code}
                          </code>
                        </td>
                        <td className="px-6 py-3">
                          {c.status === 'used' ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Ishlatilgan</span>
                          ) : (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Faol</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-slate-600">{c.validDays} kun</td>
                        <td className="px-6 py-3 text-slate-600 text-sm">{formatDateTime(c.createdAt)}</td>
                        <td className="px-6 py-3 text-slate-600 text-sm">{c.usedAt ? formatDateTime(c.usedAt) : '—'}</td>
                        <td className="px-6 py-3 text-slate-600">{c.usedByRestaurant || '—'}</td>
                        <td className="px-6 py-3">
                          {c.status === 'unused' && (
                            <button
                              onClick={() => copyCode(c.code)}
                              className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100"
                            >
                              📋 Nusxa
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'restaurants' && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Ro'yxatdan o'tgan restoranlar ({restaurants.length})</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto custom-scroll">
              <table className="w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Restoran</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Aloqa</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Holat</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Trial</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Aktivatsiya</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Kod</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {restaurants.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Hozircha restoranlar yo'q</td>
                    </tr>
                  )}
                  {restaurants.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <div className="font-semibold text-slate-900">{r.name}</div>
                        <div className="text-xs text-slate-500">{r.email}</div>
                      </td>
                      <td className="px-6 py-3 text-slate-600 text-sm">
                        <div>{r.phone || '—'}</div>
                        <div className="text-xs text-slate-400">{r.address || ''}</div>
                      </td>
                      <td className="px-6 py-3">
                        {r.status === 'active' ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Aktiv</span>
                        ) : r.status === 'trial' ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Sinov</span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Bloklangan</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-600">
                        <div>Bosh: {formatDateTime(r.trialStart)}</div>
                        <div>Tugash: {formatDateTime(r.trialEnd)}</div>
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-600">
                        {r.activatedAt ? (
                          <>
                            <div>{formatDateTime(r.activatedAt)}</div>
                            <div className="text-emerald-600">Tugash: {formatDateTime(r.activationEnd!)}</div>
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-3">
                        {r.activationCode ? (
                          <code className="text-sm font-mono font-bold text-emerald-700">{r.activationCode}</code>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
