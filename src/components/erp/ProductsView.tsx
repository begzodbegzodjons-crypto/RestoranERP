'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, useConfirm, formatNumber } from './utils'

type Product = {
  id: string
  name: string
  price: number
  cost: number
  unit: string
  description: string | null
  categoryId: string | null
  isAvailable: boolean
  category?: { id: string; name: string } | null
  recipes: { id: string; quantity: number; unit: string; cost: number; ingredient: { id: string; name: string; unit: string; unitPrice: number; stock: number } }[]
}

type Ingredient = { id: string; name: string; unit: string; unitPrice: number; stock: number }
type Category = { id: string; name: string }

export default function ProductsView() {
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Product | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [recipeOpen, setRecipeOpen] = useState<Product | null>(null)
  const { confirm, dialog } = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      const [p, i, c] = await Promise.all([
        api('/api/products'),
        api('/api/ingredients'),
        api('/api/categories')
      ])
      setProducts(p.items)
      setIngredients(i.items)
      setCategories(c.items)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const del = async (id: string) => {
    if (!(await confirm('Bu mahsulotni va uning retseptini o\'chirishni tasdiqlaysizmi?'))) return
    try {
      await api(`/api/products/${id}`, { method: 'DELETE' })
      toast.success('O\'chirildi')
      load()
    } catch (e: any) {
      toast.error(e.message)
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🍽️ Mahsulotlar va retseptlar</h2>
          <p className="text-slate-500 text-sm">Har bir taomning retsepti va avtomatik tannarxini boshqaring</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
        >
          + Yangi mahsulot
        </button>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🍽️</div>
          Mahsulotlar yo'q. Birinchi taomni qo'shing.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => {
            const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate">{p.name}</div>
                    {p.category && <div className="text-xs text-emerald-600">{p.category.name}</div>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.isAvailable ? 'Mavjud' : 'Yo\'q'}
                  </span>
                </div>

                {p.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{p.description}</p>}

                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-xs text-slate-500">Sotuv</div>
                    <div className="font-bold text-emerald-600 text-sm">{formatMoney(p.price)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-xs text-slate-500">Tannarx</div>
                    <div className="font-bold text-orange-600 text-sm">{formatMoney(p.cost)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-xs text-slate-500">Foyda</div>
                    <div className="font-bold text-teal-600 text-sm">{formatMoney(p.price - p.cost)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-slate-500">Marja: <span className="font-semibold text-slate-700">{margin.toFixed(1)}%</span></span>
                  <span className="text-slate-500">Retsept: <span className="font-semibold text-slate-700">{p.recipes.length} ta</span></span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setRecipeOpen(p)}
                    className="flex-1 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100"
                  >
                    📝 Retsept ({p.recipes.length})
                  </button>
                  <button
                    onClick={() => setEditing(p)}
                    className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => del(p.id)}
                    className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {(createOpen || editing) && (
        <ProductForm
          product={editing}
          categories={categories}
          onClose={() => { setCreateOpen(false); setEditing(null) }}
          onSaved={() => { setCreateOpen(false); setEditing(null); load() }}
        />
      )}

      {/* Recipe modal */}
      {recipeOpen && (
        <RecipeForm
          product={recipeOpen}
          ingredients={ingredients}
          onClose={() => { setRecipeOpen(null); load() }}
        />
      )}

      {dialog}
    </div>
  )
}

function ProductForm({ product, categories, onClose, onSaved }: {
  product: Product | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    categoryId: product?.categoryId || '',
    price: product?.price || 0,
    unit: product?.unit || 'dona',
    isAvailable: product?.isAvailable ?? true
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.name || form.price == null) {
      toast.error('Nom va narx majburiy')
      return
    }
    setSaving(true)
    try {
      if (product) {
        await api(`/api/products/${product.id}`, {
          method: 'PUT',
          body: JSON.stringify(form)
        })
        toast.success('Yangilandi')
      } else {
        await api('/api/products', {
          method: 'POST',
          body: JSON.stringify(form)
        })
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
    <Modal open onClose={onClose} title={product ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nomi *</label>
          <input className="erp-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tavsif</label>
          <textarea className="erp-input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Kategoriya</label>
          <select className="erp-input" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Kategoriyasiz</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Sotilish narxi *</label>
            <input type="number" className="erp-input" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Birlik</label>
            <input className="erp-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isAvailable} onChange={e => setForm({ ...form, isAvailable: e.target.checked })} className="w-4 h-4" />
          <span className="text-sm">Sotuvda mavjud</span>
        </label>

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

function RecipeForm({ product, ingredients, onClose }: {
  product: Product
  ingredients: Ingredient[]
  onClose: () => void
}) {
  const [recipes, setRecipes] = useState(product.recipes)
  const [adding, setAdding] = useState({ ingredientId: '', quantity: 0 })
  const [saving, setSaving] = useState(false)

  const addRecipe = async () => {
    if (!adding.ingredientId || !adding.quantity) {
      toast.error('Ingredient va miqdor kiriting')
      return
    }
    setSaving(true)
    try {
      const res = await api('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          ingredientId: adding.ingredientId,
          quantity: adding.quantity
        })
      })
      toast.success('Ingredient qo\'shildi')
      setRecipes([...recipes.filter(r => r.ingredientId !== adding.ingredientId), {
        id: res.item.id,
        quantity: res.item.quantity,
        unit: res.item.unit,
        cost: res.item.cost,
        ingredient: ingredients.find(i => i.id === adding.ingredientId)!
      }])
      setAdding({ ingredientId: '', quantity: 0 })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const removeRecipe = async (id: string) => {
    try {
      await api(`/api/recipes/${id}`, { method: 'DELETE' })
      setRecipes(recipes.filter(r => r.id !== id))
      toast.success('O\'chirildi')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const totalCost = recipes.reduce((s, r) => s + r.cost, 0)

  return (
    <Modal open onClose={onClose} title={`Retsept: ${product.name}`} size="lg">
      <div className="space-y-4">
        <div className="bg-emerald-50 rounded-xl p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-emerald-700">Sotuv narxi</div>
              <div className="font-bold text-emerald-900">{formatMoney(product.price)}</div>
            </div>
            <div>
              <div className="text-xs text-emerald-700">Tannarx (avto)</div>
              <div className="font-bold text-orange-700">{formatMoney(totalCost)}</div>
            </div>
            <div>
              <div className="text-xs text-emerald-700">Foyda</div>
              <div className="font-bold text-teal-700">{formatMoney(product.price - totalCost)}</div>
            </div>
          </div>
        </div>

        {/* Add new */}
        <div className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-xl">
          <div className="col-span-6">
            <label className="block text-xs font-medium text-slate-600 mb-1">Ingredient</label>
            <select
              className="erp-input"
              value={adding.ingredientId}
              onChange={e => setAdding({ ...adding, ingredientId: e.target.value })}
            >
              <option value="">Tanlang...</option>
              {ingredients.filter(i => !recipes.find(r => r.ingredientId === i.id)).map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} ({formatNumber(i.stock)} {i.unit}, {formatMoney(i.unitPrice)}/{i.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Miqdor (1 pors.)</label>
            <input
              type="number"
              className="erp-input"
              value={adding.quantity || ''}
              onChange={e => setAdding({ ...adding, quantity: parseFloat(e.target.value) || 0 })}
              placeholder="0.2"
            />
          </div>
          <div className="col-span-3">
            <button
              onClick={addRecipe}
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-emerald-500 text-white font-bold text-sm disabled:opacity-50"
            >
              + Qo'shish
            </button>
          </div>
        </div>

        {/* Recipe list */}
        <div className="space-y-2">
          {recipes.length === 0 ? (
            <p className="text-center text-slate-400 py-6">Retsept bo'sh. Ingredient qo'shing.</p>
          ) : (
            recipes.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{r.ingredient.name}</div>
                  <div className="text-xs text-slate-500">
                    {formatNumber(r.quantity)} {r.unit} × {formatMoney(r.ingredient.unitPrice)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-orange-600">{formatMoney(r.cost)}</div>
                  <div className="text-xs text-slate-400">Omborda: {formatNumber(r.ingredient.stock)} {r.ingredient.unit}</div>
                </div>
                <button onClick={() => removeRecipe(r.id)} className="text-red-400 hover:text-red-600 text-xl">×</button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
          <div className="text-sm text-slate-600">
            Jami tannarx: <span className="font-bold text-orange-600">{formatMoney(totalCost)}</span>
          </div>
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200">
            Yopish
          </button>
        </div>
      </div>
    </Modal>
  )
}
