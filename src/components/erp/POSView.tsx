'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal } from './utils'

type Product = {
  id: string; name: string; price: number; cost: number; unit: string;
  isAvailable: boolean; category?: { id: string; name: string } | null
  recipes: { ingredientId: string; quantity: number; ingredient: { stock: number; unit: string; name: string } }[]
}

type Category = { id: string; name: string }

type CartItem = { product: Product; quantity: number }

export default function POSView() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [customerId, setCustomerId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [customers, setCustomers] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [tables, setTables] = useState<any[]>([])
  const [tableId, setTableId] = useState('')
  const [processing, setProcessing] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [p, c, cust, s, t] = await Promise.all([
        api('/api/products'),
        api('/api/categories'),
        api('/api/customers'),
        api('/api/staff'),
        api('/api/tables')
      ])
      setProducts(p.items)
      setCategories(c.items)
      setCustomers(cust.items)
      setStaff(s.items)
      setTables(t.items)
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

  const addToCart = (p: Product) => {
    if (!p.isAvailable) return
    const existing = cart.find(c => c.product.id === p.id)
    if (existing) {
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
  const totalCost = cart.reduce((s, c) => s + c.product.cost * c.quantity, 0)
  const total = subtotal - discount
  const profit = total - totalCost

  const checkout = async () => {
    if (cart.length === 0) return
    setProcessing(true)
    try {
      // Check inventory for each item
      for (const item of cart) {
        for (const r of item.product.recipes) {
          const needed = r.quantity * item.quantity
          if (r.ingredient.stock < needed) {
            toast.error(`"${item.product.name}" uchun "${r.ingredient.name}" yetarli emas (kerak: ${needed} ${r.ingredient.unit}, bor: ${r.ingredient.stock} ${r.ingredient.unit})`)
            setProcessing(false)
            return
          }
        }
      }

      const res = await api('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map(c => ({ productId: c.product.id, quantity: c.quantity })),
          customerId: customerId || undefined,
          staffId: staffId || undefined,
          tableId: tableId || undefined,
          discount,
          paymentMethod
        })
      })

      toast.success(`Savdo muvaffaqiyatli! Chek: ${res.item.invoiceNo}`)
      setCart([])
      setCheckoutOpen(false)
      setDiscount(0)
      setCustomerId('')
      setStaffId('')
      setTableId('')
      load() // reload products to update availability
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setProcessing(false)
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-12rem)]">
      {/* Products grid */}
      <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <input
            className="erp-input"
            placeholder="🔍 Mahsulot qidirish..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-2 overflow-x-auto custom-scroll pb-1">
            <button
              onClick={() => setSelectedCat(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${!selectedCat ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Hammasi
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCat(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${selectedCat === c.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-4">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-12">Mahsulot topilmadi</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={!p.isAvailable}
                  className={`relative rounded-xl border text-left transition-all overflow-hidden ${
                    p.isAvailable
                      ? 'border-slate-200 hover:border-emerald-400 hover:shadow-md bg-white'
                      : 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  {p.imageUrl ? (
                    <div className="aspect-square bg-slate-100 overflow-hidden">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-square bg-slate-100 flex items-center justify-center text-4xl">🍽️</div>
                  )}
                  <div className="p-3">
                    <div className="font-semibold text-slate-900 mb-1 line-clamp-2 text-sm">{p.name}</div>
                    <div className="text-emerald-600 font-bold">{formatMoney(p.price)}</div>
                    {p.cost > 0 && (
                      <div className="text-xs text-slate-400">Tannarx: {formatMoney(p.cost)}</div>
                    )}
                  </div>
                  {p.recipes.length === 0 && (
                    <div className="absolute top-2 right-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Retsept yo'q</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 flex items-center justify-between">
            🛒 Savatcha
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline">Tozalash</button>
            )}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-4">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              <div className="text-5xl mb-3">🛒</div>
              Savatcha bo'sh
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(c => (
                <div key={c.product.id} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.product.name}</div>
                    <div className="text-xs text-slate-500">{formatMoney(c.product.price)} × {c.quantity}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(c.product.id, -1)} className="w-7 h-7 rounded bg-white border border-slate-200 font-bold text-slate-600">−</button>
                    <span className="w-8 text-center text-sm font-semibold">{c.quantity}</span>
                    <button onClick={() => updateQty(c.product.id, 1)} className="w-7 h-7 rounded bg-white border border-slate-200 font-bold text-slate-600">+</button>
                  </div>
                  <button onClick={() => removeItem(c.product.id)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-200 space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Jami:</span>
              <span className="font-semibold">{formatMoney(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-red-500">
                <span>Chegirma:</span>
                <span>−{formatMoney(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Foyda:</span>
              <span className="font-semibold">{formatMoney(profit)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-100">
              <span>To'lash:</span>
              <span>{formatMoney(total)}</span>
            </div>
            <button
              onClick={() => setCheckoutOpen(true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
            >
              💳 To'lash
            </button>
          </div>
        )}
      </div>

      {/* Checkout modal */}
      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="To'lov" size="md">
        <div className="space-y-4">
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <div className="text-sm text-emerald-700">To'lov summasi</div>
            <div className="text-3xl font-bold text-emerald-900">{formatMoney(total)}</div>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mijoz (ixtiyoriy)</label>
              <select
                className="erp-input"
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
              >
                <option value="">Tanlanmagan</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Ofitsiant</label>
              <select
                className="erp-input"
                value={staffId}
                onChange={e => setStaffId(e.target.value)}
              >
                <option value="">Tanlanmagan</option>
                {staff.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Stol (ixtiyoriy)</label>
            <select
              className="erp-input"
              value={tableId}
              onChange={e => setTableId(e.target.value)}
            >
              <option value="">Tanlanmagan</option>
              {tables.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name} ({t.seats} kishi)</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setCheckoutOpen(false)}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
            >
              Bekor
            </button>
            <button
              onClick={checkout}
              disabled={processing}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 disabled:opacity-50"
            >
              {processing ? 'Saqlanmoqda...' : '✓ Tasdiqlash'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
