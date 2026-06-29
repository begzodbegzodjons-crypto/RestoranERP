'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, useConfirm, formatNumber } from './utils'

type Ingredient = {
  id: string
  name: string
  unit: string
  stock: number
  minStock: number
  unitPrice: number
  notes: string | null
  supplier: { id: string; name: string } | null
}

type Supplier = { id: string; name: string }

export default function IngredientsView() {
  const [items, setItems] = useState<Ingredient[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const { confirm, dialog } = useConfirm()
  const [historyOpen, setHistoryOpen] = useState<Ingredient | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [i, s] = await Promise.all([api('/api/ingredients'), api('/api/suppliers')])
      setItems(i.items)
      setSuppliers(s.items)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const del = async (id: string) => {
    if (!(await confirm('Bu ingredientni o\'chirishni tasdiqlaysizmi?'))) return
    try {
      await api(`/api/ingredients/${id}`, { method: 'DELETE' })
      toast.success('O\'chirildi')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const totalValue = items.reduce((s, i) => s + i.stock * i.unitPrice, 0)

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
          <h2 className="text-2xl font-bold text-slate-900">📦 Ombor mahsulotlari</h2>
          <p className="text-slate-500 text-sm">
            Jami qiymat: <span className="font-semibold text-emerald-600">{formatMoney(totalValue)}</span>
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25"
        >
          + Yangi ingredient
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Nomi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Yetkazib beruvchi</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Qoldiq</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Min. qoldiq</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Narxi (1 birlik)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Qiymati</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Ingredientlar yo'q</td></tr>
              )}
              {items.map(i => {
                const lowStock = i.stock <= 0
                const value = i.stock * i.unitPrice
                return (
                  <tr key={i.id} className={`hover:bg-slate-50 ${lowStock ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{i.name}</div>
                      <div className="text-xs text-slate-500">{i.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{i.supplier?.name || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${lowStock ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatNumber(i.stock)} {i.unit}
                      </span>
                      {lowStock && <div className="text-xs text-red-500">⚠️ Tugagan</div>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 text-sm">{formatNumber(i.minStock)} {i.unit}</td>
                    <td className="px-4 py-3 text-right text-slate-600 text-sm">{formatMoney(i.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatMoney(value)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => setHistoryOpen(i)}
                          className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-600 hover:bg-blue-100"
                          title="Harakatlar tarixi"
                        >📋</button>
                        <button
                          onClick={() => setEditing(i)}
                          className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >✏️</button>
                        <button
                          onClick={() => del(i.id)}
                          className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100"
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(createOpen || editing) && (
        <IngredientForm
          ingredient={editing}
          suppliers={suppliers}
          onClose={() => { setCreateOpen(false); setEditing(null) }}
          onSaved={() => { setCreateOpen(false); setEditing(null); load() }}
        />
      )}

      {historyOpen && <HistoryView ingredient={historyOpen} onClose={() => setHistoryOpen(null)} />}

      {dialog}
    </div>
  )
}

function IngredientForm({ ingredient, suppliers, onClose, onSaved }: {
  ingredient: Ingredient | null
  suppliers: Supplier[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: ingredient?.name || '',
    unit: ingredient?.unit || 'kg',
    stock: ingredient?.stock || 0,
    minStock: ingredient?.minStock || 0,
    unitPrice: ingredient?.unitPrice || 0,
    supplierId: ingredient?.supplierId || '',
    notes: ingredient?.notes || ''
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.name || !form.unit) { toast.error('Nom va birlik majburiy'); return }
    setSaving(true)
    try {
      if (ingredient) {
        await api(`/api/ingredients/${ingredient.id}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Yangilandi')
      } else {
        await api('/api/ingredients', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Yaratildi')
      }
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={ingredient ? 'Ingredientni tahrirlash' : 'Yangi ingredient'} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nomi *</label>
          <input className="erp-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Un, go'sht, pomidor..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Birlik *</label>
            <select className="erp-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
              <option value="kg">kg</option>
              <option value="gr">gr</option>
              <option value="litr">litr</option>
              <option value="ml">ml</option>
              <option value="dona">dona</option>
              <option value="qop">qop</option>
              <option value="paket">paket</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Narxi (1 birlik)</label>
            <input type="number" className="erp-input" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Hozirgi qoldiq</label>
            <input type="number" className="erp-input" value={form.stock} onChange={e => setForm({ ...form, stock: parseFloat(e.target.value) || 0 })} disabled={!!ingredient} />
            {ingredient && <p className="text-xs text-slate-400 mt-1">Qoldiqni kirim/chiqim orqali o'zgartiring</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Min. qoldiq (ogohlantirish)</label>
            <input type="number" className="erp-input" value={form.minStock} onChange={e => setForm({ ...form, minStock: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Yetkazib beruvchi</label>
          <select className="erp-input" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}>
            <option value="">Tanlanmagan</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Izoh</label>
          <textarea className="erp-input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function HistoryView({ ingredient, onClose }: { ingredient: Ingredient; onClose: () => void }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api(`/api/inventory?ingredientId=${ingredient.id}`).then(r => setItems(r.items)).catch(e => toast.error(e.message)).finally(() => setLoading(false))
  }, [ingredient.id])

  return (
    <Modal open onClose={onClose} title={`Harakatlar tarixi: ${ingredient.name}`} size="lg">
      {loading ? (
        <div className="text-center py-8 text-slate-400">Yuklanmoqda...</div>
      ) : items.length === 0 ? (
        <p className="text-center text-slate-400 py-8">Harakatlar yo'q</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto custom-scroll">
          {items.map((it: any) => (
            <div key={it.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${it.type === 'in' ? 'bg-emerald-100 text-emerald-700' : it.type === 'out' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
                {it.type === 'in' ? '↓' : it.type === 'out' ? '↑' : '±'}
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-900">{it.reason}</div>
                <div className="text-xs text-slate-500">{new Date(it.createdAt).toLocaleString('uz-UZ')}</div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${it.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {it.type === 'in' ? '+' : '−'}{formatNumber(it.quantity)} {it.ingredient.unit}
                </div>
                <div className="text-xs text-slate-400">{formatMoney(it.unitPrice)}/{it.ingredient.unit}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
