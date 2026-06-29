'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatMoney, formatDateTime, Modal, useConfirm } from '../erp/utils'

type Staff = {
  id: string
  name: string
  position: string
  phone: string | null
}
type Restaurant = {
  id: string
  name: string
  currency: string
  serviceChargePercent: number
}

export default function StaffMode({ restaurantId, restaurantName, onExit }: {
  restaurantId: string
  restaurantName: string
  onExit: () => void
}) {
  const [staff, setStaff] = useState<Staff | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [view, setView] = useState<'waiter' | 'cashier' | 'settings'>(null)

  const check = async () => {
    try {
      const res = await api('/api/staff/me')
      if (res.authenticated) {
        setStaff(res.staff)
        setRestaurant(res.restaurant)
      } else {
        setStaff(null)
      }
    } catch {
      setStaff(null)
    }
  }

  useEffect(() => { check() }, []) // eslint-disable-line react-hooks/set-state-in-effect

  const logout = async () => {
    try {
      await fetch('/api/staff/me', { method: 'POST' })
    } catch {}
    setStaff(null)
    setView(null)
  }

  // PIN login screen
  if (!staff) {
    return <StaffLogin restaurantId={restaurantId} restaurantName={restaurantName} onAuthed={check} onExit={onExit} />
  }

  // Determine default view based on position
  const effectiveView = view || (staff.position === 'waiter' ? 'waiter' : staff.position === 'cashier' ? 'cashier' : null)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white">
                <path d="M3 11h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M5 11v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">{restaurantName}</div>
              <div className="text-xs text-slate-500">
                {staff.name} • {positionLabel(staff.position)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View switcher - manager can switch */}
            {(staff.position === 'manager' || staff.position === 'cashier' || staff.position === 'waiter') && (
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                {(staff.position === 'manager' || staff.position === 'waiter') && (
                  <button
                    onClick={() => setView('waiter')}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${effectiveView === 'waiter' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}
                  >
                    🍽️ Ofitsiant
                  </button>
                )}
                {(staff.position === 'manager' || staff.position === 'cashier') && (
                  <button
                    onClick={() => setView('cashier')}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${effectiveView === 'cashier' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}
                  >
                    💳 Kassir
                  </button>
                )}
              </div>
            )}
            <button onClick={logout} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm font-medium">
              🚪 Chiqish
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {effectiveView === 'waiter' && <WaiterView restaurant={restaurant} />}
        {effectiveView === 'cashier' && <CashierView restaurant={restaurant} />}
        {!effectiveView && (
          <div className="flex items-center justify-center h-full p-8 text-center text-slate-400">
            <div>
              <div className="text-5xl mb-3">👷</div>
              Sizning lavozimingiz ({positionLabel(staff.position)}) uchun POS interfeysi mavjud emas.
              <div className="mt-4">
                <button onClick={onExit} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-medium">
                  Admin panelga qaytish
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function positionLabel(p: string) {
  const m: Record<string, string> = { manager: 'Menejer', chef: 'Oshpaz', waiter: 'Ofitsiant', cashier: 'Kassir', helper: 'Yordamchi' }
  return m[p] || p
}

// ============== PIN LOGIN ==============
function StaffLogin({ restaurantId, restaurantName, onAuthed, onExit }: {
  restaurantId: string
  restaurantName: string
  onAuthed: () => void
  onExit: () => void
}) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (pin.length < 4) {
      toast.error('PIN kamida 4 raqamli bo\'lishi kerak')
      return
    }
    setLoading(true)
    try {
      await api('/api/staff/login', {
        method: 'POST',
        body: JSON.stringify({ restaurantId, pin })
      })
      toast.success('Xush kelibsiz!')
      setPin('')
      onAuthed()
    } catch (e: any) {
      toast.error(e.message)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const pressDigit = (d: string) => {
    if (pin.length < 6) {
      const newPin = pin + d
      setPin(newPin)
      if (newPin.length === 4) {
        // Auto-submit after 4 digits - but allow 5-6 too. Wait a bit.
        // For better UX, only auto-submit on explicit Enter
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-emerald-900 to-teal-900 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30 mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-9 h-9 text-white">
              <rect width="18" height="11" x="3" y="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{restaurantName}</h1>
          <p className="text-sm text-slate-500 mt-1">Xodim kirishi (PIN)</p>
        </div>

        {/* PIN display */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all ${
                i < pin.length ? 'bg-emerald-500 scale-110' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button
              key={d}
              onClick={() => pressDigit(d)}
              className="aspect-square rounded-2xl bg-slate-100 hover:bg-slate-200 text-2xl font-bold text-slate-900 active:scale-95 transition-all"
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => setPin(pin.slice(0, -1))}
            className="aspect-square rounded-2xl bg-slate-100 hover:bg-slate-200 text-xl font-bold text-slate-600 active:scale-95 transition-all"
          >
            ⌫
          </button>
          <button
            onClick={() => pressDigit('0')}
            className="aspect-square rounded-2xl bg-slate-100 hover:bg-slate-200 text-2xl font-bold text-slate-900 active:scale-95 transition-all"
          >
            0
          </button>
          <button
            onClick={submit}
            disabled={loading || pin.length < 4}
            className="aspect-square rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xl font-bold active:scale-95 transition-all disabled:opacity-50"
          >
            ✓
          </button>
        </div>

        <button
          onClick={onExit}
          className="w-full mt-6 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium"
        >
          ← Admin panelga qaytish
        </button>
      </div>
    </div>
  )
}

// ============== WAITER VIEW ==============
function WaiterView({ restaurant }: { restaurant: Restaurant | null }) {
  const [tables, setTables] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<string>('all')
  const [selectedTable, setSelectedTable] = useState<any | null>(null)
  const [cart, setCart] = useState<{ product: any; quantity: number; notes?: string }[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [t, p] = await Promise.all([api('/api/staff/tables'), api('/api/staff/products')])
      setTables(t.items)
      setRooms(t.rooms || [])
      setProducts(p.items)
      setCategories(p.categories || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = products.filter(p => {
    if (selectedCat && p.category?.id !== selectedCat) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const addToCart = (p: any) => {
    const ex = cart.find(c => c.product.id === p.id)
    if (ex) {
      setCart(cart.map(c => c.product.id === p.id ? { ...c, quantity: c.quantity + 1 } : c))
    } else {
      setCart([...cart, { product: p, quantity: 1 }])
    }
  }

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.product.id !== id) return c
      const q = c.quantity + delta
      return q <= 0 ? null! : { ...c, quantity: q }
    }).filter(Boolean))
  }

  const removeItem = (id: string) => setCart(cart.filter(c => c.product.id !== id))

  const subtotal = cart.reduce((s, c) => s + c.product.price * c.quantity, 0)
  const serviceCharge = restaurant ? subtotal * (restaurant.serviceChargePercent / 100) : 0
  const total = subtotal + serviceCharge

  const submitOrder = async () => {
    if (!selectedTable || cart.length === 0) return
    setSubmitting(true)
    try {
      const res = await api('/api/staff/orders', {
        method: 'POST',
        body: JSON.stringify({
          tableId: selectedTable.id,
          items: cart.map(c => ({
            productId: c.product.id,
            quantity: c.quantity,
            notes: c.notes
          }))
        })
      })
      toast.success(`Buyurtma yuborildi! Stol: ${selectedTable.name}`)
      setCart([])
      setSelectedTable(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
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

  // Table selection step
  if (!selectedTable) {
    return (
      <div className="p-4 sm:p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-1">🍽️ Stolni tanlang</h2>
        <p className="text-sm text-slate-500 mb-4">Buyurtma berish uchun stoldan boshlang</p>

        {/* Room filter */}
        {rooms.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setSelectedRoom('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedRoom === 'all' ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
            >
              🏠 Hammasi
            </button>
            {rooms.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRoom(r.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${selectedRoom === r.id ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
              >
                <div className={`w-2 h-2 rounded-full bg-${r.color || 'emerald'}-500`}></div>
                {r.name}
              </button>
            ))}
          </div>
        )}

        {tables.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            Stollar mavjud emas. Admin panelda stollarni qo'shing.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {tables
              .filter(t => selectedRoom === 'all' ? true : (t.roomId === selectedRoom || (!t.roomId && selectedRoom === 'all')))
              .map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTable(t)}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                  t.openOrder
                    ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
                    : 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-2xl">{t.openOrder ? '🔴' : '🟢'}</div>
                  <div className="text-xs text-slate-500">{t.seats} kishi</div>
                </div>
                <div className="font-bold text-slate-900">{t.name}</div>
                {t.room && (
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                    <div className={`w-1.5 h-1.5 rounded-full bg-${t.room.color || 'emerald'}-500`}></div>
                    {t.room.name}
                  </div>
                )}
                {t.openOrder ? (
                  <div className="mt-2 text-xs">
                    <div className="text-amber-700 font-semibold">Band: {formatMoney(t.openOrder.total)}</div>
                    <div className="text-slate-500">{t.openOrder.itemsCount} ta buyurtma</div>
                    <div className="text-slate-400">{t.openOrder.waiterName}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-emerald-600 font-medium">Bo'sh</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Menu + cart step
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-65px)]">
      {/* Products */}
      <div className="lg:col-span-2 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedTable(null)} className="text-slate-500 hover:text-slate-700">
              ← Stollar
            </button>
            <div className="font-bold text-slate-900">{selectedTable.name}</div>
            {selectedTable.openOrder && (
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">
                Joriy buyurtma: {formatMoney(selectedTable.openOrder.total)}
              </span>
            )}
          </div>
          <input
            className="erp-input"
            placeholder="🔍 Mahsulot qidirish..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-1.5 overflow-x-auto custom-scroll pb-1">
            <button
              onClick={() => setSelectedCat(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${!selectedCat ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Hammasi
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCat(c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${selectedCat === c.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-3">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Mahsulot topilmadi</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md bg-white text-left"
                >
                  <div className="font-semibold text-slate-900 text-sm line-clamp-2 mb-1">{p.name}</div>
                  <div className="text-emerald-600 font-bold">{formatMoney(p.price)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="flex flex-col bg-white overflow-hidden">
        <div className="p-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 flex items-center justify-between">
            🛒 Savatcha
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500">Tozalash</button>
            )}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-3">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              <div className="text-4xl mb-2">🛒</div>
              <div className="text-sm">Mahsulot tanlang</div>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(c => (
                <div key={c.product.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.product.name}</div>
                    <div className="text-xs text-slate-500">{formatMoney(c.product.price)} × {c.quantity}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(c.product.id, -1)} className="w-6 h-6 rounded bg-white border text-slate-600 font-bold">−</button>
                    <span className="w-6 text-center text-sm font-semibold">{c.quantity}</span>
                    <button onClick={() => updateQty(c.product.id, 1)} className="w-6 h-6 rounded bg-white border text-slate-600 font-bold">+</button>
                  </div>
                  <button onClick={() => removeItem(c.product.id)} className="text-red-400 text-lg">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-3 border-t border-slate-200 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Oraliq:</span>
              <span className="font-semibold">{formatMoney(subtotal)}</span>
            </div>
            {serviceCharge > 0 && (
              <div className="flex justify-between text-sm text-teal-600">
                <span>Xizmat ({restaurant?.serviceChargePercent}%):</span>
                <span>+{formatMoney(serviceCharge)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>Jami:</span>
              <span className="text-emerald-600">{formatMoney(total)}</span>
            </div>
            <button
              onClick={submitOrder}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 disabled:opacity-50"
            >
              {submitting ? 'Yuborilmoqda...' : `✓ Buyurtmani yuborish (${selectedTable.name})`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============== CASHIER VIEW ==============
function CashierView({ restaurant }: { restaurant: Restaurant | null }) {
  const [tables, setTables] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string>('all')
  const [orders, setOrders] = useState<any[]>([])
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discount, setDiscount] = useState(0)
  const [lastPaidOrder, setLastPaidOrder] = useState<any | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [t, o] = await Promise.all([
        api('/api/staff/tables'),
        api('/api/staff/orders?status=open')
      ])
      setTables(t.items)
      setRooms(t.rooms || [])
      setOrders(o.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const payOrder = async () => {
    if (!selectedOrder) return
    setPaying(true)
    try {
      const res = await api(`/api/staff/orders/${selectedOrder.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod, discount })
      })
      toast.success('To\'lov qabul qilindi! Chek tayyor.')
      setLastPaidOrder(res.order)
      setSelectedOrder(null)
      setDiscount(0)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPaying(false)
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

  // Tables with open orders grid
  const busyTables = tables.filter(t => t.openOrder && (selectedRoom === 'all' ? true : t.roomId === selectedRoom))

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-900">💳 Kassir paneli</h2>
        <p className="text-sm text-slate-500">Band stollarni tanlab, to'lovni qabul qiling</p>
      </div>

      {/* Room filter */}
      {rooms.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setSelectedRoom('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedRoom === 'all' ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
          >
            🏠 Hammasi
          </button>
          {rooms.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRoom(r.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${selectedRoom === r.id ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
            >
              <div className={`w-2 h-2 rounded-full bg-${r.color || 'emerald'}-500`}></div>
              {r.name}
            </button>
          ))}
        </div>
      )}

      {busyTables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">✓</div>
          Hozircha ochiq buyurtmalar yo'q. Barcha stollar bo'sh.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {busyTables.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedOrder({
                id: t.openOrder.id,
                table: t,
                ...t.openOrder
              })}
              className="bg-white rounded-2xl border-2 border-amber-200 hover:border-amber-400 hover:shadow-lg p-5 text-left transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">🍽️</div>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Band</span>
              </div>
              <div className="font-bold text-slate-900 text-lg">{t.name}</div>
              {t.room && (
                <div className="flex items-center gap-1 mb-1 text-xs text-slate-500">
                  <div className={`w-1.5 h-1.5 rounded-full bg-${t.room.color || 'emerald'}-500`}></div>
                  {t.room.name}
                </div>
              )}
              <div className="text-xs text-slate-500 mb-2">{t.openOrder.waiterName} • {formatDateTime(t.openOrder.createdAt)}</div>
              <div className="text-xs text-slate-500 mb-2">{t.openOrder.itemsCount} ta pozitsiya</div>
              <div className="text-xl font-bold text-emerald-600">{formatMoney(t.openOrder.total)}</div>
            </button>
          ))}
        </div>
      )}

      {/* Payment modal */}
      {selectedOrder && (
        <Modal open onClose={() => setSelectedOrder(null)} title={`💳 To'lov - ${selectedOrder.table.name}`} size="md">
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">Ofitsiant</div>
              <div className="font-semibold">{selectedOrder.waiterName}</div>
              <div className="text-xs text-slate-500 mt-2 mb-1">Vaqt</div>
              <div className="text-sm">{formatDateTime(selectedOrder.createdAt)}</div>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Buyurtmalar ro'yxati:</div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scroll">
                {selectedOrder.items?.map((it: any) => (
                  <div key={it.id} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{it.product.name}</div>
                      <div className="text-xs text-slate-500">{it.quantity} × {formatMoney(it.unitPrice)}</div>
                    </div>
                    <div className="font-semibold">{formatMoney(it.total)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-50 rounded-xl p-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Oraliq:</span>
                <span>{formatMoney(selectedOrder.subtotal)}</span>
              </div>
              {selectedOrder.serviceChargeAmount > 0 && (
                <div className="flex justify-between text-sm text-teal-700">
                  <span>Xizmat ({selectedOrder.serviceChargePercent}%):</span>
                  <span>+{formatMoney(selectedOrder.serviceChargeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-emerald-200">
                <span>Jami:</span>
                <span className="text-emerald-700">{formatMoney(selectedOrder.total)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Chegirma (UZS)</label>
              <input
                type="number"
                className="erp-input"
                value={discount || ''}
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">To'lov turi</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'cash', l: '💵 Naqd' },
                  { v: 'card', l: '💳 Karta' },
                  { v: 'transfer', l: '🔄 O\'tkazma' }
                ].map(m => (
                  <button
                    key={m.v}
                    onClick={() => setPaymentMethod(m.v)}
                    className={`py-2.5 rounded-lg text-sm font-medium ${paymentMethod === m.v ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {m.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-xl p-4 text-center">
              <div className="text-xs text-slate-400">To'lash kerak</div>
              <div className="text-3xl font-bold">{formatMoney(Math.max(0, selectedOrder.total - discount))}</div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Bekor
              </button>
              <button
                onClick={payOrder}
                disabled={paying}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 disabled:opacity-50"
              >
                {paying ? 'Qabul qilinmoqda...' : '✓ To\'lov + Chek'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Receipt modal - print */}
      {lastPaidOrder && (
        <ReceiptModal
          order={lastPaidOrder}
          restaurant={restaurant}
          onClose={() => setLastPaidOrder(null)}
        />
      )}
    </div>
  )
}

// ============== RECEIPT (PRINT) ==============
function ReceiptModal({ order, restaurant, onClose }: {
  order: any
  restaurant: Restaurant | null
  onClose: () => void
}) {
  const printReceipt = () => {
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) {
      toast.error('Pop-up bloklangan. Iltimos, ruxsat bering.')
      return
    }

    const items = order.items.map((it: any) => `
      <tr>
        <td style="padding:2px 0;">${it.product.name}<br><small style="color:#666;">${it.quantity} × ${formatMoney(it.unitPrice)}</small></td>
        <td style="text-align:right;vertical-align:top;padding:2px 0;">${formatMoney(it.total)}</td>
      </tr>
    `).join('')

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Chek ${order.invoiceNo}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; padding: 10px; width: 80mm; color: #000; }
          h1 { font-size: 16px; text-align: center; margin: 5px 0; }
          .center { text-align: center; }
          .small { font-size: 11px; }
          .bold { font-weight: bold; }
          hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
          table { width: 100%; font-size: 12px; }
          .total { font-size: 14px; font-weight: bold; }
          .row { display: flex; justify-content: space-between; font-size: 12px; padding: 1px 0; }
        </style>
      </head>
      <body>
        <h1>${restaurant?.name || 'Restoran'}</h1>
        <div class="center small">
          ${order.table ? order.table.name : ''}<br>
          Sana: ${formatDateTime(order.paidAt || new Date())}<br>
          Chek #: ${order.invoiceNo}
        </div>
        <hr>
        <div class="bold small">Ofitsiant: ${order.waiter?.name || '—'}</div>
        <div class="bold small">Kassir: ${order.cashier?.name || '—'}</div>
        <hr>
        <table>
          ${items}
        </table>
        <hr>
        <div class="row"><span>Oraliq:</span><span>${formatMoney(order.subtotal)}</span></div>
        ${order.serviceChargeAmount > 0 ? `<div class="row"><span>Xizmat (${order.serviceChargePercent}%):</span><span>+${formatMoney(order.serviceChargeAmount)}</span></div>` : ''}
        ${order.discount > 0 ? `<div class="row"><span>Chegirma:</span><span>-${formatMoney(order.discount)}</span></div>` : ''}
        <hr>
        <div class="row total"><span>JAMI:</span><span>${formatMoney(order.total)}</span></div>
        <div class="row"><span>To'lov (${order.paymentMethod === 'cash' ? 'Naqd' : order.paymentMethod === 'card' ? 'Karta' : 'O\'tkazma'}):</span><span>${formatMoney(order.total)}</span></div>
        <hr>
        <div class="center small">
          Rahmat!<br>
          Yana keling!
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <Modal open onClose={onClose} title="🧾 Chek tayyor" size="sm">
      <div className="space-y-4 text-center">
        <div className="text-5xl">✓</div>
        <div className="text-lg font-bold text-slate-900">To'lov qabul qilindi!</div>
        <div className="bg-slate-50 rounded-xl p-4 text-left text-sm space-y-1">
          <div className="flex justify-between"><span className="text-slate-500">Chek #:</span><span className="font-mono font-semibold">{order.invoiceNo}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Stol:</span><span className="font-semibold">{order.table?.name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Ofitsiant:</span><span className="font-semibold">{order.waiter?.name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Summa:</span><span className="font-semibold text-emerald-600">{formatMoney(order.total)}</span></div>
        </div>
        <button
          onClick={printReceipt}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800"
        >
          🖨️ Chekni chop etish
        </button>
        <button
          onClick={onClose}
          className="w-full py-2 text-slate-500 text-sm font-medium"
        >
          Yopish
        </button>
      </div>
    </Modal>
  )
}
