'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatMoney, formatNumber, formatDateTime, Modal, useConfirm } from '../erp/utils'

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
  blockedByAdmin: boolean
  blockedReason: string | null
  blockedAt: string | null
  adminNotes: string | null
  createdAt: string
  updatedAt: string
  access: {
    state: 'trial' | 'active' | 'blocked'
    daysLeft: number
    endDate: string
    message: string
    blockedByAdmin?: boolean
  }
  stats: {
    products: number
    ingredients: number
    customers: number
    sales: number
    totalRevenue: number
    totalProfit: number
  }
}

type GlobalStats = {
  restaurants: { total: number; active: number; trial: number; blocked: number; newThisMonth: number }
  codes: { total: number; used: number; unused: number }
  sales: {
    totalRevenue: number
    totalProfit: number
    totalCost: number
    totalOrders: number
    todayRevenue: number
    todayOrders: number
    monthRevenue: number
    monthProfit: number
    monthOrders: number
  }
  catalog: { totalProducts: number; totalIngredients: number; totalCustomers: number; totalStaff: number }
  newRestaurants7days: { date: string; count: number }[]
  revenue7days: { date: string; total: number }[]
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'login' | 'panel'>('login')
  const [password, setPassword] = useState('')
  const [tab, setTab] = useState<'overview' | 'codes' | 'restaurants'>('overview')
  const [codes, setCodes] = useState<Code[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [genCount, setGenCount] = useState(1)
  const [genDays, setGenDays] = useState(30)
  const [recentlyGenerated, setRecentlyGenerated] = useState<Code[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'trial' | 'blocked'>('all')
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const { confirm, dialog } = useConfirm()

  useEffect(() => {
    fetch('/api/admin/login').then(r => {
      if (r.ok) setStep('panel')
    }).catch(() => {})
  }, [])

  const login = async () => {
    setLoading(true)
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) })
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
      const [codesRes, restRes, statsRes] = await Promise.all([
        api('/api/admin/codes'),
        api('/api/admin/restaurants'),
        api('/api/admin/stats')
      ])
      setCodes(codesRes.codes || [])
      setRestaurants(restRes.restaurants || [])
      setGlobalStats(statsRes)
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

  const blockRestaurant = async (r: Restaurant) => {
    const reason = prompt('Blok sababi (ixtiyoriy):', 'To\'lov amalga oshirilmadi')
    if (reason === null) return
    try {
      await api(`/api/admin/restaurants/${r.id}/block`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      })
      toast.success(`${r.name} bloklandi`)
      loadData()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const unblockRestaurant = async (r: Restaurant) => {
    if (!(await confirm(`${r.name} blokdan chiqarilsinmi?`))) return
    try {
      await api(`/api/admin/restaurants/${r.id}/block`, { method: 'DELETE' })
      toast.success(`${r.name} blokdan chiqarildi`)
      loadData()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const activateRestaurant = async (r: Restaurant, days: number, note?: string) => {
    try {
      const res = await api(`/api/admin/restaurants/${r.id}/activate`, {
        method: 'POST',
        body: JSON.stringify({ days, note })
      })
      toast.success(res.message)
      loadData()
    } catch (e: any) {
      toast.error(e.message)
    }
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
            <button onClick={login} disabled={loading || !password}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all disabled:opacity-50"
            >
              {loading ? 'Tekshirilmoqda...' : 'Kirish'}
            </button>
            <button onClick={onClose} className="w-full py-2 text-emerald-200/70 hover:text-white text-sm font-medium">
              ← Bosh sahifaga qaytish
            </button>
          </div>
        </div>
      </div>
    )
  }

  const filteredRestaurants = restaurants.filter(r => {
    if (filterStatus !== 'all' && r.access.state !== filterStatus) return false
    if (search) {
      const s = search.toLowerCase()
      return r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s) || (r.phone || '').includes(s)
    }
    return true
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
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
            <button onClick={loadData} className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors text-sm">↻ Yangilash</button>
            <button onClick={logout} className="px-4 py-2 rounded-lg bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors text-sm">Chiqish</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-xl border border-slate-200 w-fit overflow-x-auto">
          <button onClick={() => setTab('overview')} className={`px-6 py-2.5 rounded-lg font-semibold transition-colors whitespace-nowrap ${tab === 'overview' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>📊 Umumiy</button>
          <button onClick={() => setTab('restaurants')} className={`px-6 py-2.5 rounded-lg font-semibold transition-colors whitespace-nowrap ${tab === 'restaurants' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>🏪 Restoranlar ({restaurants.length})</button>
          <button onClick={() => setTab('codes')} className={`px-6 py-2.5 rounded-lg font-semibold transition-colors whitespace-nowrap ${tab === 'codes' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>🔑 Aktivatsiya kodlari ({codes.length})</button>
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && globalStats && (
          <div className="space-y-6">
            {/* Main stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <BigStat title="Jami restoranlar" value={globalStats.restaurants.total} sub={`Bu oy: +${globalStats.restaurants.newThisMonth}`} color="emerald" icon="🏪" />
              <BigStat title="Aktiv" value={globalStats.restaurants.active} sub="To'langan obuna" color="teal" icon="✓" />
              <BigStat title="Sinovda" value={globalStats.restaurants.trial} sub="Bepul sinov" color="amber" icon="⏱️" />
              <BigStat title="Bloklangan" value={globalStats.restaurants.blocked} sub="To'lov kutmoqda" color="red" icon="🚫" />
            </div>

            {/* Revenue stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <BigStat title="Bugungi daromad" value={formatMoney(globalStats.sales.todayRevenue)} sub={`${globalStats.sales.todayOrders} buyurtma`} color="emerald" icon="💰" />
              <BigStat title="Oylik daromad" value={formatMoney(globalStats.sales.monthRevenue)} sub={`${globalStats.sales.monthOrders} buyurtma`} color="teal" icon="📅" />
              <BigStat title="Oylik foyda" value={formatMoney(globalStats.sales.monthProfit)} sub="Barcha restoranlar" color="cyan" icon="📈" />
              <BigStat title="Jami daromad" value={formatMoney(globalStats.sales.totalRevenue)} sub={`${globalStats.sales.totalOrders} buyurtma`} color="emerald" icon="🏆" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-4">📅 So'nggi 7 kun - Yangi restoranlar</h3>
                {(() => {
                  const max = Math.max(...globalStats.newRestaurants7days.map(d => d.count), 1)
                  return (
                    <div className="space-y-2">
                      {globalStats.newRestaurants7days.map(d => (
                        <div key={d.date} className="flex items-center gap-3">
                          <div className="w-24 text-xs text-slate-500">{new Date(d.date).toLocaleDateString('uz-UZ', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>
                          <div className="flex-1 bg-slate-100 rounded h-7 overflow-hidden">
                            <div className="h-full bg-emerald-500 flex items-center justify-end pr-2" style={{ width: `${(d.count / max) * 100}%`, minWidth: d.count > 0 ? '40px' : '0' }}>
                              {d.count > 0 && <span className="text-xs font-semibold text-white">{d.count}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-4">💵 So'nggi 7 kun - Daromad</h3>
                {(() => {
                  const max = Math.max(...globalStats.revenue7days.map(d => d.total), 1)
                  return (
                    <div className="space-y-2">
                      {globalStats.revenue7days.map(d => (
                        <div key={d.date} className="flex items-center gap-3">
                          <div className="w-24 text-xs text-slate-500">{new Date(d.date).toLocaleDateString('uz-UZ', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>
                          <div className="flex-1 bg-slate-100 rounded h-7 overflow-hidden">
                            <div className="h-full bg-teal-500 flex items-center justify-end pr-2" style={{ width: `${(d.total / max) * 100}%`, minWidth: d.total > 0 ? '60px' : '0' }}>
                              {d.total > 0 && <span className="text-xs font-semibold text-white">{formatMoney(d.total)}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Catalog stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <BigStat title="Jami taomlar" value={globalStats.catalog.totalProducts} sub="Barcha restoranlar" color="slate" icon="🍽️" />
              <BigStat title="Jami ombor" value={globalStats.catalog.totalIngredients} sub="Ingredientlar" color="slate" icon="📦" />
              <BigStat title="Jami mijozlar" value={globalStats.catalog.totalCustomers} sub="CRM" color="slate" icon="👥" />
              <BigStat title="Jami xodimlar" value={globalStats.catalog.totalStaff} sub="Barcha restoranlar" color="slate" icon="👷" />
            </div>

            {/* Codes summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-4">🔑 Aktivatsiya kodlari holati</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-slate-900">{globalStats.codes.total}</div>
                  <div className="text-sm text-slate-500">Jami</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-600">{globalStats.codes.unused}</div>
                  <div className="text-sm text-emerald-700">Ishlatilmagan</div>
                </div>
                <div className="bg-slate-100 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-slate-500">{globalStats.codes.used}</div>
                  <div className="text-sm text-slate-600">Ishlatilgan</div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <button onClick={() => setTab('codes')} className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold text-sm">Kodlarni boshqarish →</button>
              </div>
            </div>
          </div>
        )}

        {/* RESTAURANTS TAB */}
        {tab === 'restaurants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Restoranlar ({filteredRestaurants.length} / {restaurants.length})</h3>
                <p className="text-sm text-slate-500">Boshqarish uchun restoranni bosing</p>
              </div>
              <div className="flex gap-2">
                <input
                  className="erp-input max-w-xs"
                  placeholder="🔍 Qidirish (nom, email, telefon)..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select
                  className="erp-input max-w-[140px]"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as any)}
                >
                  <option value="all">Hammasi</option>
                  <option value="active">Aktiv</option>
                  <option value="trial">Sinovda</option>
                  <option value="blocked">Bloklangan</option>
                </select>
              </div>
            </div>

            {filteredRestaurants.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                Restoranlar topilmadi
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Restoran</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Holat</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Taomlar</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Savdo</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Daromad</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Foyda</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Qolgan kun</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Boshqarish</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRestaurants.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedRestaurant(r)}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{r.name}</div>
                            <div className="text-xs text-slate-500">{r.email}</div>
                            {r.phone && <div className="text-xs text-slate-400">📞 {r.phone}</div>}
                          </td>
                          <td className="px-4 py-3">
                            {r.access.blockedByAdmin ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">🚫 Admin blok</span>
                            ) : r.access.state === 'active' ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">✓ Aktiv</span>
                            ) : r.access.state === 'trial' ? (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">⏱ Sinov</span>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">✗ Blok</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-700">{r.stats.products}</td>
                          <td className="px-4 py-3 text-center text-slate-700">{r.stats.sales}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatMoney(r.stats.totalRevenue)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-teal-600">{formatMoney(r.stats.totalProfit)}</td>
                          <td className="px-4 py-3 text-center">
                            {r.access.daysLeft > 0 ? (
                              <span className="font-bold text-slate-700">{r.access.daysLeft}k</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-center gap-1">
                              {r.access.blockedByAdmin ? (
                                <button onClick={() => unblockRestaurant(r)} className="px-2 py-1 rounded text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium" title="Blokdan chiqarish">🔓</button>
                              ) : (
                                <>
                                  <button onClick={() => activateRestaurant(r, 30)} className="px-2 py-1 rounded text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium" title="30 kun aktivlashtirish">+30k</button>
                                  <button onClick={() => blockRestaurant(r)} className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100 font-medium" title="Bloklash">🚫</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CODES TAB */}
        {tab === 'codes' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Yangi aktivatsiya kodi generatsiya qilish</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Miqdor</label>
                  <input type="number" min="1" max="50" value={genCount} onChange={e => setGenCount(parseInt(e.target.value) || 1)} className="erp-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Amal qilish (kun)</label>
                  <input type="number" min="1" max="365" value={genDays} onChange={e => setGenDays(parseInt(e.target.value) || 30)} className="erp-input" />
                </div>
                <div className="flex items-end">
                  <button onClick={generateCodes} disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50">
                    {loading ? 'Generatsiya...' : '🔑 Kod generatsiya qilish'}
                  </button>
                </div>
              </div>
              {recentlyGenerated.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-sm font-bold text-emerald-900 mb-2">✓ Generatsiya qilingan kodlar:</div>
                  <div className="space-y-2">
                    {recentlyGenerated.map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-white rounded-lg p-3">
                        <code className="text-2xl font-mono font-bold tracking-widest text-emerald-700">{c.code}</code>
                        <button onClick={() => copyCode(c.code)} className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-medium hover:bg-emerald-200">📋 Nusxalash</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5"><div className="text-sm text-slate-500 mb-1">Jami kodlar</div><div className="text-3xl font-bold text-slate-900">{codes.length}</div></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5"><div className="text-sm text-slate-500 mb-1">Ishlatilmagan</div><div className="text-3xl font-bold text-emerald-600">{codes.filter(c => c.status === 'unused').length}</div></div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5"><div className="text-sm text-slate-500 mb-1">Ishlatilgan</div><div className="text-3xl font-bold text-slate-500">{codes.filter(c => c.status === 'used').length}</div></div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200"><h3 className="text-lg font-bold text-slate-900">Barcha aktivatsiya kodlari</h3></div>
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
                    {codes.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">Hozircha kodlar yo'q</td></tr>}
                    {codes.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3"><code className={`text-lg font-mono font-bold tracking-wider ${c.status === 'used' ? 'text-slate-400' : 'text-emerald-700'}`}>{c.code}</code></td>
                        <td className="px-6 py-3">{c.status === 'used' ? <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Ishlatilgan</span> : <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Faol</span>}</td>
                        <td className="px-6 py-3 text-slate-600">{c.validDays} kun</td>
                        <td className="px-6 py-3 text-slate-600 text-sm">{formatDateTime(c.createdAt)}</td>
                        <td className="px-6 py-3 text-slate-600 text-sm">{c.usedAt ? formatDateTime(c.usedAt) : '—'}</td>
                        <td className="px-6 py-3 text-slate-600">{c.usedByRestaurant || '—'}</td>
                        <td className="px-6 py-3">{c.status === 'unused' && <button onClick={() => copyCode(c.code)} className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100">📋 Nusxa</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Restaurant detail modal */}
      {selectedRestaurant && (
        <RestaurantDetailModal
          restaurant={selectedRestaurant}
          onClose={() => setSelectedRestaurant(null)}
          onBlock={(r) => { blockRestaurant(r); setSelectedRestaurant(null) }}
          onUnblock={(r) => { unblockRestaurant(r); setSelectedRestaurant(null) }}
          onActivate={(r, days, note) => { activateRestaurant(r, days, note); setSelectedRestaurant(null) }}
        />
      )}

      {dialog}
    </div>
  )
}

function BigStat({ title, value, sub, color, icon }: { title: string; value: string | number; sub: string; color: string; icon: string }) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500 to-teal-600',
    teal: 'from-teal-500 to-cyan-600',
    cyan: 'from-cyan-500 to-blue-600',
    amber: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-orange-600',
    slate: 'from-slate-600 to-slate-700'
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-xl shadow-md`}>{icon}</div>
      </div>
      <div className="text-sm text-slate-500 mb-1">{title}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  )
}

// ============================================================
// RESTAURANT DETAIL MODAL - to'liq statistika va boshqaruv
// ============================================================
function RestaurantDetailModal({
  restaurant,
  onClose,
  onBlock,
  onUnblock,
  onActivate
}: {
  restaurant: Restaurant
  onClose: () => void
  onBlock: (r: Restaurant) => void
  onUnblock: (r: Restaurant) => void
  onActivate: (r: Restaurant, days: number, note?: string) => void
}) {
  const [details, setDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activateDays, setActivateDays] = useState(30)
  const [activateNote, setActivateNote] = useState('')
  const [showActivateForm, setShowActivateForm] = useState(false)

  useEffect(() => {
    api(`/api/admin/restaurants/${restaurant.id}/stats`)
      .then(r => setDetails(r))
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [restaurant.id])

  const stateBadge = {
    trial: { label: 'Sinovda', cls: 'bg-amber-100 text-amber-700' },
    active: { label: 'Aktiv', cls: 'bg-emerald-100 text-emerald-700' },
    blocked: { label: 'Bloklangan', cls: 'bg-red-100 text-red-700' }
  }
  const badge = restaurant.access.blockedByAdmin
    ? { label: '🚫 Admin bloklagan', cls: 'bg-red-100 text-red-700' }
    : stateBadge[restaurant.access.state]

  return (
    <Modal open onClose={onClose} title={`🏪 ${restaurant.name}`} size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : details ? (
        <div className="space-y-5">
          {/* Header */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div>
                <h3 className="text-2xl font-bold">{restaurant.name}</h3>
                <p className="text-emerald-50 text-sm">{restaurant.email}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.cls}`}>{badge.label}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-emerald-50 text-xs">Telefon</div><div className="font-semibold">{restaurant.phone || '—'}</div></div>
              <div><div className="text-emerald-50 text-xs">Manzil</div><div className="font-semibold">{restaurant.address || '—'}</div></div>
              <div><div className="text-emerald-50 text-xs">Ro'yxatga olingan</div><div className="font-semibold">{formatDateTime(restaurant.createdAt)}</div></div>
              <div><div className="text-emerald-50 text-xs">Tugash sanasi</div><div className="font-semibold">{restaurant.access.endDate ? new Date(restaurant.access.endDate).toLocaleDateString('uz-UZ') : '—'}</div></div>
            </div>
            {restaurant.access.daysLeft > 0 && (
              <div className="mt-3 text-sm bg-white/20 rounded-lg px-3 py-2 inline-block">
                ⏱ {restaurant.access.daysLeft} kun qoldi
              </div>
            )}
          </div>

          {/* Admin block warning */}
          {restaurant.access.blockedByAdmin && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="font-bold text-red-900 mb-1">🚫 Admin tomonidan bloklangan</div>
              <div className="text-sm text-red-700">Sabab: {restaurant.blockedReason || 'Ko\'rsatilmagan'}</div>
              {restaurant.blockedAt && <div className="text-xs text-red-600 mt-1">Vaqt: {formatDateTime(restaurant.blockedAt)}</div>}
            </div>
          )}

          {/* Stats grid */}
          <div>
            <h4 className="font-bold text-slate-900 mb-3">📊 Statistika</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Jami daromad" value={formatMoney(details.stats.totalRevenue)} color="emerald" />
              <StatBox label="Jami foyda" value={formatMoney(details.stats.totalProfit)} color="teal" />
              <StatBox label="Jami savdo" value={`${details.stats.totalOrders} ta`} color="cyan" />
              <StatBox label="O'rtacha chek" value={formatMoney(details.stats.avgOrder)} color="slate" />
              <StatBox label="Bugungi daromad" value={formatMoney(details.stats.todayRevenue)} sub={`${details.stats.todayOrders} buyurtma`} color="emerald" />
              <StatBox label="Oylik daromad" value={formatMoney(details.stats.monthRevenue)} sub={`${details.stats.monthOrders} buyurtma`} color="teal" />
              <StatBox label="Oylik foyda" value={formatMoney(details.stats.monthProfit)} color="cyan" />
              <StatBox label="Oylik sof foyda" value={formatMoney(details.stats.monthNetProfit)} sub={`Xarajat: ${formatMoney(details.stats.monthExpenses)}`} color={details.stats.monthNetProfit >= 0 ? 'emerald' : 'red'} />
            </div>
          </div>

          {/* Catalog counts */}
          <div>
            <h4 className="font-bold text-slate-900 mb-3">🍽️ Katalog</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <CountBox label="Taomlar" value={details.counts.products} icon="🍽️" />
              <CountBox label="Kategoriyalar" value={details.counts.categories} icon="🏷️" />
              <CountBox label="Ombor" value={details.counts.ingredients} icon="📦" />
              <CountBox label="Mijozlar" value={details.counts.customers} icon="👥" />
              <CountBox label="Xodimlar" value={details.counts.staff} icon="👷" />
              <CountBox label="Stollar" value={details.counts.tables} icon="🪑" />
            </div>
          </div>

          {/* Inventory & alert */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-sm text-slate-500 mb-1">Ombor qiymati</div>
              <div className="text-2xl font-bold text-slate-900">{formatMoney(details.stats.inventoryValue)}</div>
            </div>
            <div className={`rounded-xl p-4 ${details.stats.lowStockCount > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <div className={`text-sm mb-1 ${details.stats.lowStockCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>Tugagan mahsulotlar</div>
              <div className={`text-2xl font-bold ${details.stats.lowStockCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{details.stats.lowStockCount} ta</div>
            </div>
          </div>

          {/* Daily revenue chart */}
          {details.dailyRevenue && details.dailyRevenue.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-900 mb-3">📈 So'nggi 14 kun daromad</h4>
              <div className="bg-slate-50 rounded-xl p-4">
                {(() => {
                  const max = Math.max(...details.dailyRevenue.map((d: any) => d.sales), 1)
                  return (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scroll">
                      {details.dailyRevenue.map((d: any) => (
                        <div key={d.date} className="flex items-center gap-2">
                          <div className="w-20 text-xs text-slate-500">{new Date(d.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })}</div>
                          <div className="flex-1 bg-white rounded h-5 overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${(d.sales / max) * 100}%`, minWidth: d.sales > 0 ? '20px' : '0' }} />
                          </div>
                          <div className="w-32 text-right text-xs font-medium text-slate-700">{formatMoney(d.sales)}</div>
                          <div className="w-12 text-right text-xs text-emerald-600">+{formatMoney(d.profit)}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Top products */}
          {details.topProducts && details.topProducts.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-900 mb-3">🏆 Top mahsulotlar (30 kun)</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll">
                {details.topProducts.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-xs text-slate-400">{i + 1}</span>
                      <span className="font-medium text-slate-900 text-sm">{p.name}</span>
                      <span className="text-xs text-slate-400">{formatNumber(p.qty)} ta</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-900 text-sm">{formatMoney(p.revenue)}</div>
                      <div className="text-xs text-emerald-600">+{formatMoney(p.profit)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent sales */}
          {details.recentSales && details.recentSales.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-900 mb-3">🧾 So'nggi savdolar</h4>
              <div className="space-y-1 max-h-40 overflow-y-auto custom-scroll">
                {details.recentSales.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-2 border-b border-slate-100 last:border-0">
                    <div>
                      <div className="font-medium text-sm text-slate-900">{s.invoiceNo}</div>
                      <div className="text-xs text-slate-400">{formatDateTime(s.createdAt)} • {s.itemCount} pozitsiya</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{formatMoney(s.total)}</div>
                      <div className="text-xs text-emerald-600">+{formatMoney(s.profit)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Management actions */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h4 className="font-bold text-slate-900">⚙️ Boshqaruv</h4>

            {/* Activate form */}
            <div className="bg-emerald-50 rounded-xl p-4">
              <div className="font-semibold text-emerald-900 mb-2">✓ Kodsiz aktivlashtirish (admin tomonidan)</div>
              {!showActivateForm ? (
                <button onClick={() => setShowActivateForm(true)} className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold text-sm">
                  Aktivlashtirish formasi
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="block text-xs text-emerald-800 mb-1">Kun soni</label>
                      <input type="number" min="1" max="3650" value={activateDays} onChange={e => setActivateDays(parseInt(e.target.value) || 30)} className="erp-input" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-emerald-800 mb-1">Izoh (ixtiyoriy)</label>
                      <input value={activateNote} onChange={e => setActivateNote(e.target.value)} className="erp-input" placeholder="Masalan: Naqd to'lov" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onActivate(restaurant, activateDays, activateNote)} className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold text-sm">
                      ✓ {activateDays} kunga aktivlashtirish
                    </button>
                    <button onClick={() => setShowActivateForm(false)} className="px-4 py-2 rounded-lg bg-white text-slate-700 font-medium text-sm border border-slate-200">Bekor</button>
                  </div>
                  <p className="text-xs text-emerald-700">Agar restoran hozir aktiv bo'lsa, kunlar qo'shiladi (uzaytiriladi).</p>
                </div>
              )}
            </div>

            {/* Block/Unblock */}
            <div className="flex gap-2">
              {restaurant.access.blockedByAdmin ? (
                <button onClick={() => onUnblock(restaurant)} className="flex-1 py-2.5 rounded-lg bg-emerald-500 text-white font-semibold text-sm">
                  🔓 Blokdan chiqarish
                </button>
              ) : (
                <button onClick={() => onBlock(restaurant)} className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-semibold text-sm">
                  🚫 Bloklash
                </button>
              )}
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">
                Yopish
              </button>
            </div>

            {/* Admin notes */}
            {restaurant.adminNotes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="text-xs font-bold text-amber-900 mb-1">📝 Admin izohlari</div>
                <div className="text-sm text-amber-800 whitespace-pre-wrap">{restaurant.adminNotes}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center text-slate-400 py-12">Ma'lumot topilmadi</div>
      )}
    </Modal>
  )
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600',
    teal: 'text-teal-600',
    cyan: 'text-cyan-600',
    red: 'text-red-500',
    slate: 'text-slate-900'
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${colors[color] || colors.slate}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function CountBox({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
