'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, formatDateTime, formatNumber } from './utils'

type Ingredient = { id: string; name: string; unit: string; unitPrice: number; stock: number }
type Supplier = { id: string; name: string }
type Purchase = {
  id: string; invoiceNo: string; totalAmount: number; status: string; createdAt: string; notes: string | null
  supplier: { name: string } | null
  items: { id: string; quantity: number; unit: string; unitPrice: number; total: number; ingredient: { id: string; name: string; unit: string } }[]
}

export default function PurchasesView() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [p, i, s] = await Promise.all([api('/api/purchases'), api('/api/ingredients'), api('/api/suppliers')])
      setPurchases(p.items)
      setIngredients(i.items)
      setSuppliers(s.items)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalThisMonth = purchases
    .filter(p => new Date(p.createdAt).getMonth() === new Date().getMonth())
    .reduce((s, p) => s + p.totalAmount, 0)

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
          <h2 className="text-2xl font-bold text-slate-900">🚚 Kirim (xomashyo sotib olish)</h2>
          <p className="text-slate-500 text-sm">Bu oy jami: <span className="font-semibold text-emerald-600">{formatMoney(totalThisMonth)}</span></p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25"
        >
          + Yangi kirim
        </button>
      </div>

      {purchases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🚚</div>
          Kirimlar yo'q
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="font-bold text-slate-900">{p.invoiceNo}</div>
                  {p.supplier && <span className="text-sm text-slate-500">← {p.supplier.name}</span>}
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-600">{formatMoney(p.totalAmount)}</div>
                  <div className="text-xs text-slate-400">{formatDateTime(p.createdAt)}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {p.items.map(it => (
                  <div key={it.id} className="flex items-center justify-between text-sm py-1.5 border-t border-slate-50 first:border-0">
                    <span className="text-slate-700">
                      <span className="font-medium">{it.ingredient.name}</span>
                      <span className="text-slate-400 ml-2">{formatNumber(it.quantity)} {it.unit} × {formatMoney(it.unitPrice)}</span>
                    </span>
                    <span className="font-medium text-slate-900">{formatMoney(it.total)}</span>
                  </div>
                ))}
              </div>
              {p.notes && <div className="mt-2 text-xs text-slate-500 italic">📝 {p.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <PurchaseForm
          ingredients={ingredients}
          suppliers={suppliers}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); load() }}
        />
      )}
    </div>
  )
}

function PurchaseForm({ ingredients, suppliers, onClose, onSaved }: {
  ingredients: Ingredient[]
  suppliers: Supplier[]
  onClose: () => void
  onSaved: () => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<{ ingredientId: string; quantity: number; unitPrice: number; unit: string }[]>([])
  const [adding, setAdding] = useState({ ingredientId: '', quantity: 0, unitPrice: 0 })
  const [saving, setSaving] = useState(false)

  const add = () => {
    if (!adding.ingredientId || !adding.quantity || !adding.unitPrice) {
      toast.error('Barcha maydonlarni to\'ldiring')
      return
    }
    const ing = ingredients.find(i => i.id === adding.ingredientId)
    if (!ing) return
    setItems([...items, { ...adding, unit: ing.unit }])
    setAdding({ ingredientId: '', quantity: 0, unitPrice: 0 })
  }

  const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

  const save = async () => {
    if (items.length === 0) { toast.error('Kamida 1 ta ingredient qo\'shing'); return }
    setSaving(true)
    try {
      await api('/api/purchases', {
        method: 'POST',
        body: JSON.stringify({ supplierId: supplierId || undefined, items, notes })
      })
      toast.success('Kirim muvaffaqiyatli qo\'shildi. Ombor avtomatik yangilandi.')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Yangi kirim" size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Yetkazib beruvchi</label>
            <select className="erp-input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">Tanlanmagan</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Izoh</label>
            <input className="erp-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl">
          <div className="col-span-5">
            <label className="block text-xs font-medium text-slate-600 mb-1">Ingredient</label>
            <select className="erp-input" value={adding.ingredientId} onChange={e => {
              const ing = ingredients.find(i => i.id === e.target.value)
              setAdding({ ...adding, ingredientId: e.target.value, unitPrice: ing?.unitPrice || 0 })
            }}>
              <option value="">Tanlang...</option>
              {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} (omborda: {formatNumber(i.stock)} {i.unit})</option>)}
            </select>
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Miqdor</label>
            <input type="number" className="erp-input" value={adding.quantity || ''} onChange={e => setAdding({ ...adding, quantity: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Narx (1 birlik)</label>
            <input type="number" className="erp-input" value={adding.unitPrice || ''} onChange={e => setAdding({ ...adding, unitPrice: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="col-span-1">
            <button onClick={add} className="w-full py-2.5 rounded-lg bg-emerald-500 text-white font-bold">+</button>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto custom-scroll">
          {items.length === 0 ? (
            <p className="text-center text-slate-400 py-6">Ingredient qo'shing</p>
          ) : items.map((it, idx) => {
            const ing = ingredients.find(i => i.id === it.ingredientId)
            return (
              <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{ing?.name}</div>
                  <div className="text-xs text-slate-500">{formatNumber(it.quantity)} {it.unit} × {formatMoney(it.unitPrice)}</div>
                </div>
                <div className="font-bold text-slate-900">{formatMoney(it.quantity * it.unitPrice)}</div>
                <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xl">×</button>
              </div>
            )
          })}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
          <div className="text-lg font-bold text-slate-900">
            Jami: <span className="text-emerald-600">{formatMoney(total)}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
            <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50">
              {saving ? 'Saqlanmoqda...' : '✓ Saqlash'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
