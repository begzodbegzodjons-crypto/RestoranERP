'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, useConfirm, formatDateTime, formatNumber } from './utils'

// ============== GENERIC CRUD VIEW ==============
type Field = {
  key: string
  label: string
  type?: 'text' | 'number' | 'select' | 'textarea' | 'tel'
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
}

export function CrudView<T extends { id: string }>({
  title, emoji, endpoint, fields, columns, searchKey
}: {
  title: string
  emoji: string
  endpoint: string
  fields: Field[]
  columns: { key: string; label: string; render?: (item: any) => React.ReactNode; className?: string }[]
  searchKey?: string
}) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<T | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { confirm, dialog } = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(endpoint)
      setItems(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const del = async (id: string) => {
    if (!(await confirm('O\'chirishni tasdiqlaysizmi?'))) return
    try {
      await api(`${endpoint}/${id}`, { method: 'DELETE' })
      toast.success('O\'chirildi')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const filtered = searchKey
    ? items.filter((item: any) => String(item[searchKey] || '').toLowerCase().includes(search.toLowerCase()))
    : items

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
          <h2 className="text-2xl font-bold text-slate-900">{emoji} {title}</h2>
          <p className="text-slate-500 text-sm">Jami: {items.length} ta</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25"
        >
          + Yangi qo'shish
        </button>
      </div>

      {searchKey && (
        <input
          className="erp-input max-w-md"
          placeholder="🔍 Qidirish..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {columns.map(c => (
                  <th key={c.key} className={`px-4 py-3 text-xs font-semibold text-slate-600 uppercase ${c.className || 'text-left'}`}>{c.label}</th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={columns.length + 1} className="px-4 py-12 text-center text-slate-400">Yozuvlar yo'q</td></tr>
              )}
              {filtered.map(item => (
                <tr key={(item as any).id} className="hover:bg-slate-50">
                  {columns.map(c => (
                    <td key={c.key} className={`px-4 py-3 text-sm ${c.className || 'text-left'}`}>
                      {c.render ? c.render(item) : String((item as any)[c.key] ?? '—')}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => setEditing(item)} className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700 hover:bg-slate-200">✏️</button>
                      <button onClick={() => del((item as any).id)} className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(createOpen || editing) && (
        <CrudForm
          title={title}
          fields={fields}
          item={editing}
          endpoint={endpoint}
          onClose={() => { setCreateOpen(false); setEditing(null) }}
          onSaved={() => { setCreateOpen(false); setEditing(null); load() }}
        />
      )}

      {dialog}
    </div>
  )
}

function CrudForm({ title, fields, item, endpoint, onClose, onSaved }: {
  title: string
  fields: Field[]
  item: any
  endpoint: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<any>(() => {
    const init: any = {}
    fields.forEach(f => {
      init[f.key] = item?.[f.key] ?? (f.type === 'number' ? 0 : '')
    })
    return init
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    for (const f of fields) {
      if (f.required && !form[f.key]) {
        toast.error(`${f.label} majburiy`)
        return
      }
    }
    setSaving(true)
    try {
      if (item) {
        await api(`${endpoint}/${item.id}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Yangilandi')
      } else {
        await api(endpoint, { method: 'POST', body: JSON.stringify(form) })
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
    <Modal open onClose={onClose} title={item ? `${title}ni tahrirlash` : `Yangi ${title.toLowerCase()}`} size="md">
      <div className="space-y-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {f.label} {f.required && <span className="text-red-500">*</span>}
            </label>
            {f.type === 'textarea' ? (
              <textarea className="erp-input" rows={2} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} />
            ) : f.type === 'select' ? (
              <select className="erp-input" value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
                <option value="">Tanlang...</option>
                {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                className="erp-input"
                value={form[f.key] ?? ''}
                onChange={e => setForm({ ...form, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                placeholder={f.placeholder}
              />
            )}
          </div>
        ))}
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

// ============== CUSTOMERS ==============
export function CustomersView() {
  return <CrudView
    title="Mijozlar"
    emoji="👥"
    endpoint="/api/customers"
    searchKey="name"
    fields={[
      { key: 'name', label: 'Ism', required: true, placeholder: 'Aliyev Ali' },
      { key: 'phone', label: 'Telefon', type: 'tel', placeholder: '+998 90 123 45 67' },
      { key: 'email', label: 'Email', placeholder: 'email@example.com' },
      { key: 'address', label: 'Manzil' },
      { key: 'notes', label: 'Izoh', type: 'textarea' }
    ]}
    columns={[
      { key: 'name', label: 'Ism', render: (i: any) => <div className="font-semibold text-slate-900">{i.name}</div> },
      { key: 'phone', label: 'Telefon', render: (i: any) => i.phone || '—' },
      { key: 'totalOrders', label: 'Buyurtmalar', className: 'text-right', render: (i: any) => <span className="font-semibold">{i.totalOrders}</span> },
      { key: 'totalSpent', label: 'Sarflagan', className: 'text-right', render: (i: any) => <span className="text-emerald-600 font-semibold">{formatMoney(i.totalSpent)}</span> },
      { key: 'createdAt', label: 'Ro\'yxatga olingan', render: (i: any) => <span className="text-xs text-slate-500">{formatDateTime(i.createdAt)}</span> }
    ]}
  />
}

// ============== STAFF ==============
export function StaffView() {
  return <CrudView
    title="Xodimlar"
    emoji="👷"
    endpoint="/api/staff"
    searchKey="name"
    fields={[
      { key: 'name', label: 'Ism', required: true },
      { key: 'phone', label: 'Telefon', type: 'tel' },
      { key: 'position', label: 'Lavozim', type: 'select', options: [
        { value: 'manager', label: 'Menejer' },
        { value: 'chef', label: 'Oshpaz' },
        { value: 'waiter', label: 'Ofitsiant' },
        { value: 'cashier', label: 'Kassir' },
        { value: 'helper', label: 'Yordamchi' }
      ]},
      { key: 'salary', label: 'Maosh (UZS)', type: 'number' },
      { key: 'status', label: 'Holat', type: 'select', options: [
        { value: 'active', label: 'Faol' },
        { value: 'inactive', label: 'Nofaol' }
      ]}
    ]}
    columns={[
      { key: 'name', label: 'Ism', render: (i: any) => <div className="font-semibold text-slate-900">{i.name}</div> },
      { key: 'position', label: 'Lavozim', render: (i: any) => i.position || '—' },
      { key: 'phone', label: 'Telefon', render: (i: any) => i.phone || '—' },
      { key: 'salary', label: 'Maosh', className: 'text-right', render: (i: any) => formatMoney(i.salary) },
      { key: 'status', label: 'Holat', render: (i: any) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${i.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {i.status === 'active' ? 'Faol' : 'Nofaol'}
        </span>
      )}
    ]}
  />
}

// ============== TABLES ==============
export function TablesView() {
  return <CrudView
    title="Stollar"
    emoji="🪑"
    endpoint="/api/tables"
    searchKey="name"
    fields={[
      { key: 'name', label: 'Nomi', required: true, placeholder: 'Stol 1' },
      { key: 'seats', label: 'O\'rindiqlar soni', type: 'number', required: true },
      { key: 'status', label: 'Holat', type: 'select', options: [
        { value: 'free', label: 'Bo\'sh' },
        { value: 'occupied', label: 'Band' },
        { value: 'reserved', label: 'Bron qilingan' }
      ]}
    ]}
    columns={[
      { key: 'name', label: 'Nomi', render: (i: any) => <div className="font-semibold text-slate-900">{i.name}</div> },
      { key: 'seats', label: 'O\'rindiqlar', className: 'text-right', render: (i: any) => `${i.seats} kishi` },
      { key: 'status', label: 'Holat', render: (i: any) => {
        const m: Record<string, { label: string; cls: string }> = {
          free: { label: 'Bo\'sh', cls: 'bg-emerald-100 text-emerald-700' },
          occupied: { label: 'Band', cls: 'bg-red-100 text-red-700' },
          reserved: { label: 'Bron', cls: 'bg-amber-100 text-amber-700' }
        }
        const s = m[i.status] || m.free
        return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>
      }}
    ]}
  />
}

// ============== SUPPLIERS ==============
export function SuppliersView() {
  return <CrudView
    title="Yetkazib beruvchilar"
    emoji="🚚"
    endpoint="/api/suppliers"
    searchKey="name"
    fields={[
      { key: 'name', label: 'Nomi', required: true },
      { key: 'phone', label: 'Telefon', type: 'tel' },
      { key: 'address', label: 'Manzil' },
      { key: 'notes', label: 'Izoh', type: 'textarea' }
    ]}
    columns={[
      { key: 'name', label: 'Nomi', render: (i: any) => <div className="font-semibold text-slate-900">{i.name}</div> },
      { key: 'phone', label: 'Telefon', render: (i: any) => i.phone || '—' },
      { key: 'address', label: 'Manzil', render: (i: any) => i.address || '—' },
      { key: 'createdAt', label: 'Qo\'shilgan', render: (i: any) => <span className="text-xs text-slate-500">{formatDateTime(i.createdAt)}</span> }
    ]}
  />
}

// ============== EXPENSES ==============
export function ExpensesView() {
  return <CrudView
    title="Chiqimlar"
    emoji="💸"
    endpoint="/api/expenses"
    fields={[
      { key: 'category', label: 'Kategoriya', type: 'select', required: true, options: [
        { value: 'rent', label: 'Ijara' },
        { value: 'salary', label: 'Maosh' },
        { value: 'utility', label: 'Kommunal' },
        { value: 'marketing', label: 'Reklama' },
        { value: 'equipment', label: 'Uskuna' },
        { value: 'other', label: 'Boshqa' }
      ]},
      { key: 'amount', label: 'Summa (UZS)', type: 'number', required: true },
      { key: 'date', label: 'Sana', type: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'description', label: 'Tavsif', type: 'textarea' }
    ]}
    columns={[
      { key: 'category', label: 'Kategoriya', render: (i: any) => {
        const m: Record<string, string> = { rent: '🏠 Ijara', salary: '👷 Maosh', utility: '💡 Kommunal', marketing: '📢 Reklama', equipment: '🔧 Uskuna', other: '📦 Boshqa' }
        return <span className="font-medium">{m[i.category] || i.category}</span>
      }},
      { key: 'amount', label: 'Summa', className: 'text-right', render: (i: any) => <span className="font-bold text-red-500">−{formatMoney(i.amount)}</span> },
      { key: 'description', label: 'Tavsif', render: (i: any) => <span className="text-sm text-slate-600">{i.description || '—'}</span> },
      { key: 'date', label: 'Sana', render: (i: any) => <span className="text-xs text-slate-500">{formatDateTime(i.date)}</span> }
    ]}
  />
}

// ============== CATEGORIES ==============
export function CategoriesView() {
  return <CrudView
    title="Kategoriyalar"
    emoji="🏷️"
    endpoint="/api/categories"
    searchKey="name"
    fields={[
      { key: 'name', label: 'Nomi', required: true, placeholder: 'Issiq taomlar, Salatlar, Ichimliklar...' },
      { key: 'description', label: 'Tavsif', type: 'textarea' }
    ]}
    columns={[
      { key: 'name', label: 'Nomi', render: (i: any) => <div className="font-semibold text-slate-900">{i.name}</div> },
      { key: 'description', label: 'Tavsif', render: (i: any) => i.description || '—' },
      { key: '_count', label: 'Mahsulotlar', className: 'text-right', render: (i: any) => <span className="font-semibold">{i._count?.products || 0} ta</span> }
    ]}
  />
}
