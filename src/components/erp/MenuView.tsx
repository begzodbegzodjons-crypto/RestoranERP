'use client'

import { useState, useEffect, useRef } from 'react'
import { api, toast, formatMoney, Modal, useConfirm } from './utils'
import EmojiPicker from './EmojiPicker'

type Product = {
  id: string
  name: string
  price: number
  cost: number
  unit: string
  description: string | null
  imageUrl: string | null
  isAvailable: boolean
  categoryId: string | null
  category: { id: string; name: string } | null
  recipes: any[]
}

type Category = { id: string; name: string; description: string | null }

export default function MenuView() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [productModal, setProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [catModal, setCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const { confirm, dialog } = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      const [p, c] = await Promise.all([api('/api/products'), api('/api/categories')])
      setProducts(p.items)
      setCategories(c.items)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = products.filter(p => {
    if (selectedCat && p.categoryId !== selectedCat) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const deleteProduct = async (p: Product) => {
    if (!(await confirm(`"${p.name}" taomini o'chirishni tasdiqlaysizmi?`))) return
    try {
      await api(`/api/products/${p.id}`, { method: 'DELETE' })
      toast.success('Taom o\'chirildi')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const deleteCategory = async (c: Category) => {
    const count = products.filter(p => p.categoryId === c.id).length
    if (!(await confirm(`"${c.name}" kategoriyasini o'chirishni tasdiqlaysizmi?${count > 0 ? `\n\n${count} ta taom shu kategoriyada - ular "kategoriyasiz" bo'lib qoladi.` : ''}`))) return
    try {
      await api(`/api/categories/${c.id}`, { method: 'DELETE' })
      toast.success('Kategoriya o\'chirildi')
      if (selectedCat === c.id) setSelectedCat(null)
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">📋 Menyu</h2>
          <p className="text-slate-500 text-sm">{products.length} ta taom • {categories.length} ta kategoriya</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingCat(null); setCatModal(true) }}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
          >
            🏷️ + Kategoriya
          </button>
          <button
            onClick={() => { setEditingProduct(null); setProductModal(true) }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25"
          >
            🍽️ + Taom qo'shish
          </button>
        </div>
      </div>

      {/* Search + Category filter */}
      <div className="flex gap-3 flex-wrap">
        <input
          className="erp-input max-w-xs"
          placeholder="🔍 Taom qidirish..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setSelectedCat(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!selectedCat ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
          >
            Hammasi ({products.length})
          </button>
          {categories.map(c => {
            const count = products.filter(p => p.categoryId === c.id).length
            return (
              <div key={c.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => setSelectedCat(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedCat === c.id ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                >
                  {c.name} ({count})
                </button>
                <button
                  onClick={() => { setEditingCat(c); setCatModal(true) }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-slate-600 px-1"
                  title="Tahrirlash"
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteCategory(c)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 px-1"
                  title="O'chirish"
                >
                  🗑️
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Product grid - kartochkali ko'rinish */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🍽️</div>
          {search || selectedCat ? 'Taom topilmadi' : 'Hozircha taomlar yo\'q. Birinchi taomni qo\'shing!'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map(p => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all group"
            >
              {/* Image - emoji ko'rsatish (imageUrl maydonida emoji saqlanadi) */}
              <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden flex items-center justify-center">
                <span className="text-6xl">{p.imageUrl || '🍽️'}</span>
                {/* Availability badge */}
                {!p.isAvailable && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">Mavjud emas</span>
                  </div>
                )}
                {/* Category badge */}
                {p.category && (
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/90 text-slate-700 backdrop-blur">
                      {p.category.name}
                    </span>
                  </div>
                )}
                {/* Action buttons (hover) */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingProduct(p); setProductModal(true) }}
                    className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur flex items-center justify-center text-slate-700 hover:bg-white shadow"
                    title="Tahrirlash"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteProduct(p)}
                    className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur flex items-center justify-center text-red-500 hover:bg-white shadow"
                    title="O'chirish"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="font-semibold text-slate-900 text-sm line-clamp-2 mb-1 min-h-[2.5rem]">{p.name}</div>
                <div className="flex items-center justify-between">
                  <div className="text-emerald-600 font-bold">{formatMoney(p.price)}</div>
                  {p.recipes.length > 0 && (
                    <span className="text-xs text-slate-400" title="Retsept bor">
                      📝 {p.recipes.length}
                    </span>
                  )}
                </div>
                {p.cost > 0 && (
                  <div className="text-xs text-slate-400 mt-0.5">
                    Tannarx: {formatMoney(p.cost)} • Foyda: {formatMoney(p.price - p.cost)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product form modal */}
      {productModal && (
        <ProductForm
          product={editingProduct}
          categories={categories}
          onClose={() => { setProductModal(false); setEditingProduct(null) }}
          onSaved={() => { setProductModal(false); setEditingProduct(null); load() }}
        />
      )}

      {/* Category form modal */}
      {catModal && (
        <CategoryForm
          category={editingCat}
          onClose={() => { setCatModal(false); setEditingCat(null) }}
          onSaved={() => { setCatModal(false); setEditingCat(null); load() }}
        />
      )}

      {dialog}
    </div>
  )
}

// ============== PRODUCT FORM (with emoji picker) ==============
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
    isAvailable: product?.isAvailable ?? true,
    imageUrl: product?.imageUrl || ''
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
        toast.success('Taom yangilandi')
      } else {
        await api('/api/products', {
          method: 'POST',
          body: JSON.stringify(form)
        })
        toast.success('Taom qo\'shildi')
      }
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={product ? 'Taomini tahrirlash' : 'Yangi taom qo\'shish'} size="md">
      <div className="space-y-4">
        {/* Emoji picker - rasm o'rniga emoji ishlatamiz */}
        {/* Sababi: rasm yuklash TiDB hotirasini tez tugatadi (100-200 ta taom = 100-200 MB) */}
        {/* Emoji = 4 byte, 1 million ta emoji = 4 MB */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Taom rasmi (emoji)
          </label>
          <EmojiPicker
            value={form.imageUrl}
            onChange={(emoji) => setForm({ ...form, imageUrl: emoji })}
          />
          <p className="text-xs text-slate-500 mt-2">
            💡 Taom uchun mos emoji tanlang. Rasm yuklash o'rniga emoji ishlatish
            tezroq va server hotirasini tejaydi.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Taom nomi *</label>
          <input
            className="erp-input"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Manti, Osh, Lag'mon..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tavsif</label>
          <textarea
            className="erp-input"
            rows={2}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Qiymali manti, qo'y go'shtidan..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Kategoriya</label>
          <select
            className="erp-input"
            value={form.categoryId}
            onChange={e => setForm({ ...form, categoryId: e.target.value })}
          >
            <option value="">Kategoriyasiz</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Sotilish narxi *</label>
            <input
              type="number"
              className="erp-input"
              value={form.price}
              onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Birlik</label>
            <select
              className="erp-input"
              value={form.unit}
              onChange={e => setForm({ ...form, unit: e.target.value })}
            >
              <option value="dona">dona</option>
              <option value="porsiya">porsiya</option>
              <option value="kg">kg</option>
              <option value="gram">gram</option>
              <option value="litr">litr</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isAvailable}
            onChange={e => setForm({ ...form, isAvailable: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm">Sotuvda mavjud (POS va menyuda ko'rinadi)</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
          >
            Bekor
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============== CATEGORY FORM ==============
function CategoryForm({ category, onClose, onSaved }: {
  category: Category | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: category?.name || '',
    description: category?.description || ''
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.name) {
      toast.error('Kategoriya nomi majburiy')
      return
    }
    setSaving(true)
    try {
      if (category) {
        await api(`/api/categories/${category.id}`, {
          method: 'PUT',
          body: JSON.stringify(form)
        })
        toast.success('Kategoriya yangilandi')
      } else {
        await api('/api/categories', {
          method: 'POST',
          body: JSON.stringify(form)
        })
        toast.success('Kategoriya qo\'shildi')
      }
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={category ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'} size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Kategoriya nomi *</label>
          <input
            className="erp-input"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Issiq taomlar, Salatlar, Ichimliklar..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tavsif</label>
          <textarea
            className="erp-input"
            rows={2}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">
            Bekor
          </button>
          <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
