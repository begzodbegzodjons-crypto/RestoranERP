'use client'

import { useState, useEffect } from 'react'
import { api, toast, Modal, useConfirm } from './utils'

type Branch = {
  id: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  _count?: { orders?: number; staff?: number }
}

export default function BranchesView() {
  const [items, setItems] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const { confirm, dialog } = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/branches')
      setItems(res.items || res || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const del = async (b: Branch) => {
    if (!(await confirm(`"${b.name}" filialini o'chirishni tasdiqlaysizmi?`))) return
    try {
      await api(`/api/branches/${b.id}`, { method: 'DELETE' })
      toast.success('Filial o\'chirildi')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const toggleActive = async (b: Branch) => {
    try {
      await api(`/api/branches/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !b.isActive })
      })
      toast.success(b.isActive ? 'Filial o\'chirildi' : 'Filial faollashtirildi')
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🏪 Filiallar boshqaruvi</h2>
          <p className="text-slate-500 text-sm">Restoran filiallari va ularning ma'lumotlari</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25"
        >
          + Yangi filial
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🏪</div>
          Filiallar topilmadi. Yangi filial qo'shing.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(b => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl shrink-0">
                    🏪
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{b.name}</div>
                    <div className="text-xs text-slate-500">
                      {b._count?.orders || 0} buyurtma · {b._count?.staff || 0} xodim
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                    b.isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {b.isActive ? 'Faol' : 'Nofaol'}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-start gap-2 text-slate-700">
                  <span className="shrink-0">📍</span>
                  <span className="break-words">{b.address || 'Manzil kiritilmagan'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="shrink-0">📞</span>
                  <span>{b.phone || 'Telefon kiritilmagan'}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => { setEditing(b); setShowForm(true) }}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-medium"
                >
                  ✏️ Tahrirlash
                </button>
                <button
                  onClick={() => toggleActive(b)}
                  className="px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium"
                  title="Faollikni o'zgartirish"
                >
                  {b.isActive ? '⏸️' : '▶️'}
                </button>
                <button
                  onClick={() => del(b)}
                  className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium"
                  title="O'chirish"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <BranchForm
          branch={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
      {dialog}
    </div>
  )
}

function BranchForm({
  branch,
  onClose,
  onSaved
}: {
  branch: Branch | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(branch?.name || '')
  const [address, setAddress] = useState(branch?.address || '')
  const [phone, setPhone] = useState(branch?.phone || '')
  const [isActive, setIsActive] = useState(branch?.isActive ?? true)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) {
      toast.error('Filial nomini kiriting')
      return
    }
    setSaving(true)
    try {
      if (branch) {
        await api(`/api/branches/${branch.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, address, phone, isActive })
        })
        toast.success('Filial yangilandi')
      } else {
        await api('/api/branches', {
          method: 'POST',
          body: JSON.stringify({ name, address, phone, isActive })
        })
        toast.success('Filial yaratildi')
      }
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={branch ? 'Filialni tahrirlash' : 'Yangi filial qo\'shish'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Filial nomi</label>
          <input
            className="erp-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Markaziy filial, Chilonzor filiali..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Manzil</label>
          <textarea
            className="erp-input"
            rows={2}
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Toshkent sh., Amir Temur ko'chasi 12"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefon</label>
          <input
            className="erp-input"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+998 71 123 45 67"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-emerald-500"
          />
          <span className="text-sm font-medium text-slate-700">Faol filial</span>
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
          >
            Bekor
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : '✓ Saqlash'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
