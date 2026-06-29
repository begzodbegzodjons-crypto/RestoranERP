'use client'

import { useState, useEffect } from 'react'
import { api, toast, Modal, useConfirm } from './utils'

type PrinterStation = {
  id: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  _count?: { categories: number; printJobs: number }
}

type Category = {
  id: string
  name: string
  printerStationId: string | null
  printerStation: { id: string; name: string } | null
  _count?: { products: number }
}

export default function PrintersView() {
  const [stations, setStations] = useState<PrinterStation[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<PrinterStation | null>(null)
  const { confirm, dialog } = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([api('/api/printers'), api('/api/categories')])
      setStations(s.items || [])
      setCategories(c.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const del = async (s: PrinterStation) => {
    if (!(await confirm(`"${s.name}" printer stansiyasini o'chirishni tasdiqlaysizmi?\n\nKategoriyalar bog'lanishi o'chiriladi.`))) return
    try {
      await api(`/api/printers/${s.id}`, { method: 'DELETE' })
      toast.success('Printer stansiyasi o\'chirildi')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const assignCategory = async (catId: string, printerId: string) => {
    try {
      await api(`/api/categories/${catId}`, {
        method: 'PUT',
        body: JSON.stringify({ printerStationId: printerId || null })
      })
      toast.success('Kategoriya printerga bog\'landi')
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🖨️ Printer stansiyalari</h2>
          <p className="text-slate-500 text-sm">
            Printerlarni sozlang va kategoriyalarni bog'lang. Ofitsiant buyurtma bosganda, avtomatik tegishli printerga yuboriladi.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModal(true) }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25"
        >
          ➕ Printer qo'shish
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="font-semibold text-blue-900 mb-2">📋 Qanday ishlaydi?</div>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Printer stansiyalari yarating (masalan: "Shashlik printer", "Oshpaz printer", "Bar printer")</li>
          <li>Kategoriyalarni printerlarga bog'lang (masalan: "Grill" → Shashlik printer)</li>
          <li>Ofitsiant buyurtma bosganda, har taom kategoriyasiga qarab avtomatik print job yaratiladi</li>
          <li>Kassir "Print Queue" panelida har bir printer uchun cheklarni ko'rib, bosib chiqaradi</li>
          <li>Hammasi kassa kompyuterida — printerlar kassaga ulangan bo'ladi</li>
        </ol>
      </div>

      {/* Printer stations grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <div className="text-5xl mb-3">🖨️</div>
            Printer stansiyalari yo'q. Birinchi printerni qo'shing!
          </div>
        ) : (
          stations.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-xl">
                    🖨️
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{s.name}</div>
                    {s.description && <div className="text-xs text-slate-500">{s.description}</div>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(s); setModal(true) }} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200">✏️</button>
                  <button onClick={() => del(s)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">🗑️</button>
                </div>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  {s._count?.categories || 0} ta kategoriya
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {s._count?.printJobs || 0} ta print job
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Category → Printer assignment */}
      {stations.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">🏷️ Kategoriyalarni printerga bog'lash</h3>
            <p className="text-xs text-slate-500">Har kategoriya uchun qaysi printerga yuborilishini tanlang</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Kategoriya</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Taomlar</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Printer stansiyasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Kategoriyalar yo'q</td></tr>
                ) : (
                  categories.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{c._count?.products || 0}</td>
                      <td className="px-4 py-3">
                        <select
                          value={c.printerStationId || ''}
                          onChange={e => assignCategory(c.id, e.target.value)}
                          className="erp-input max-w-[200px]"
                        >
                          <option value="">— Printer yo'q —</option>
                          {stations.map(s => (
                            <option key={s.id} value={s.id}>🖨️ {s.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <PrinterForm
          station={editing}
          onClose={() => { setModal(false); setEditing(null) }}
          onSaved={() => { setModal(false); setEditing(null); load() }}
        />
      )}

      {dialog}
    </div>
  )
}

function PrinterForm({ station, onClose, onSaved }: {
  station: PrinterStation | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: station?.name || '',
    description: station?.description || '',
    sortOrder: station?.sortOrder || 0,
    isActive: station?.isActive ?? true
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.name) { toast.error('Printer nomi majburiy'); return }
    setSaving(true)
    try {
      if (station) {
        await api(`/api/printers/${station.id}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Printer yangilandi')
      } else {
        await api('/api/printers', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Printer qo\'shildi')
      }
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={station ? 'Printer tahrirlash' : 'Yangi printer stansiyasi'} size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Printer nomi *</label>
          <input
            className="erp-input"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder='Masalan: "Shashlik printer", "Oshpaz printer", "Bar printer"'
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tavsif</label>
          <textarea
            className="erp-input"
            rows={2}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Masalan: Gril taomlar uchun printer"
          />
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
