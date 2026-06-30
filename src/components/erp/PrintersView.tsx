'use client'

import { useState, useEffect } from 'react'
import { api, toast, Modal, useConfirm } from './utils'

type PrinterStation = {
  id: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  autoPrint: boolean
  printerIp: string | null
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
  const [reassignModal, setReassignModal] = useState(false)
  const [reassignCat, setReassignCat] = useState<Category | null>(null)
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

  const reorder = async (id: string, direction: 'up' | 'down') => {
    try {
      await api(`/api/printers/${id}/reorder`, {
        method: 'POST',
        body: JSON.stringify({ direction })
      })
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
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const toggleAutoPrint = async (s: PrinterStation) => {
    try {
      await api(`/api/printers/${s.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...s, autoPrint: !s.autoPrint })
      })
      toast.success(`${s.name}: avtomatik print ${!s.autoPrint ? 'yoqildi' : 'o\'chirildi'}`)
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
            Printerlarni boshqaring: qo'shish, tartibini o'zgartirish, kategoriyalarni bog'lash
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
          <li>Printer stansiyalari yarating (Shashlik printer, Oshpaz printer, Bar printer, ...)</li>
          <li>↑↓ tugmalari bilan printerlarni tartiblang (qaysi birinchi ko'rinishi)</li>
          <li>Kategoriyalarni printerga bog'lang (Grill → Shashlik printer)</li>
          <li>Agar noto'g'ri printerga bog'langan bo'lsa — dropdown dan o'zgartiring</li>
          <li>⚡ Avtomatik print yoqilgan bo'lsa — ofitsiant buyurtma bosganda avtomatik chop etiladi</li>
        </ol>
      </div>

      {/* Printer stations - sorted by sortOrder */}
      <div className="space-y-3">
        {stations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <div className="text-5xl mb-3">🖨️</div>
            Printer stansiyalari yo'q. Birinchi printerni qo'shing!
          </div>
        ) : (
          stations.map((s, idx) => {
            const assignedCats = categories.filter(c => c.printerStationId === s.id)
            return (
              <div key={s.id} className={`bg-white rounded-2xl border-2 ${s.autoPrint ? 'border-emerald-200' : 'border-slate-200'} overflow-hidden`}>
                {/* Printer header */}
                <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => reorder(s.id, 'up')}
                        disabled={idx === 0}
                        className="w-7 h-5 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-30 flex items-center justify-center text-xs"
                        title="Yuqoriga"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => reorder(s.id, 'down')}
                        disabled={idx === stations.length - 1}
                        className="w-7 h-5 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-30 flex items-center justify-center text-xs"
                        title="Pastga"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </div>

                    <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center text-2xl">
                      🖨️
                    </div>
                    <div>
                      <div className="font-bold text-lg flex items-center gap-2">
                        {s.name}
                        {s.autoPrint ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500 text-white">⚡ Avto</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500 text-white">Qo'lda</span>
                        )}
                      </div>
                      {s.description && <div className="text-xs text-slate-300">{s.description}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick toggle autoPrint */}
                    <button
                      onClick={() => toggleAutoPrint(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${s.autoPrint ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-600 hover:bg-slate-500'} text-white`}
                    >
                      {s.autoPrint ? '⚡ Avto yoqilgan' : '⚡ Avto o\'chiq'}
                    </button>
                    <button onClick={() => { setEditing(s); setModal(true) }} className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium">
                      ✏️ Tahrirlash
                    </button>
                    <button onClick={() => del(s)} className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium">
                      🗑️ O'chirish
                    </button>
                  </div>
                </div>

                {/* Printer body - assigned categories */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-slate-700">
                      📎 Bog'langan kategoriyalar ({assignedCats.length})
                    </div>
                    <div className="text-xs text-slate-500">
                      {s._count?.printJobs || 0} ta print job tarixda
                    </div>
                  </div>

                  {assignedCats.length === 0 ? (
                    <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-400 text-sm">
                      Bu printerga hozircha kategoriya bog'lanmagan.
                      <br />
                      Pastdagi jadvaldan kategoriyani tanlab bog'lang.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {assignedCats.map(c => (
                        <div key={c.id} className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm">🏷️</span>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 text-sm truncate">{c.name}</div>
                              <div className="text-xs text-slate-500">{c._count?.products || 0} ta taom</div>
                            </div>
                          </div>
                          <button
                            onClick={() => { setReassignCat(c); setReassignModal(true) }}
                            className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0 px-1"
                            title="Boshqa printerga ko'chirish"
                          >
                            🔄
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Category → Printer assignment table */}
      {stations.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-900">🔄 Kategoriyalarni printerga bog'lash</h3>
            <p className="text-xs text-slate-500">
              Agar kategoriya noto'g'ri printerga bog'langan bo'lsa (masalan, shashlik oshpaz printerga ketib qolsa) — dropdown dan o'zgartiring
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Kategoriya</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Taomlar</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Joriy printer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">O'zgartirish</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Tezkor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Kategoriyalar yo'q. Avval kategoriya qo'shing.</td></tr>
                ) : (
                  categories.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{c._count?.products || 0}</td>
                      <td className="px-4 py-3">
                        {c.printerStation ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100">
                            🖨️ {c.printerStation.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">— Printer yo'q —</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={c.printerStationId || ''}
                          onChange={e => assignCategory(c.id, e.target.value)}
                          className="erp-input max-w-[200px] text-sm"
                        >
                          <option value="">— Printer yo'q —</option>
                          {stations.map(s => (
                            <option key={s.id} value={s.id}>🖨️ {s.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => { setReassignCat(c); setReassignModal(true) }}
                          className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                          🔄 Ko'chirish
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add unassigned categories note */}
      {categories.some(c => !c.printerStationId) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="font-semibold text-amber-900 mb-1">⚠️ Bog'lanmagan kategoriyalar</div>
          <p className="text-sm text-amber-800">
            {categories.filter(c => !c.printerStationId).map(c => c.name).join(', ')} — bu kategoriyalardagi taomlar uchun chek chiqmaydi.
            Yuqoridagi jadvaldan printerga bog'lang.
          </p>
        </div>
      )}

      {modal && (
        <PrinterForm
          station={editing}
          onClose={() => { setModal(false); setEditing(null) }}
          onSaved={() => { setModal(false); setEditing(null); load() }}
        />
      )}

      {/* Reassign modal */}
      {reassignModal && reassignCat && (
        <Modal open onClose={() => { setReassignModal(false); setReassignCat(null) }} title={`"${reassignCat.name}" kategoriyasini ko'chirish`} size="sm">
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Bu kategoriyadagi taomlar ({reassignCat._count?.products || 0} ta) qaysi printerga yuborilsin?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => { assignCategory(reassignCat.id, ''); setReassignModal(false); setReassignCat(null) }}
                className={`w-full p-3 rounded-xl border-2 text-left ${!reassignCat.printerStationId ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚫</span>
                  <div>
                    <div className="font-semibold text-slate-900">Printerga bog'lamaslik</div>
                    <div className="text-xs text-slate-500">Chek chiqmaydi</div>
                  </div>
                </div>
              </button>
              {stations.map(s => (
                <button
                  key={s.id}
                  onClick={() => { assignCategory(reassignCat.id, s.id); setReassignModal(false); setReassignCat(null) }}
                  className={`w-full p-3 rounded-xl border-2 text-left ${reassignCat.printerStationId === s.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🖨️</span>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.description || 'Tavsif yo\'q'}</div>
                    </div>
                    {s.autoPrint && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⚡ Avto</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Modal>
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
    isActive: station?.isActive ?? true,
    autoPrint: station?.autoPrint ?? true,
    printerIp: station?.printerIp || ''
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
    <Modal open onClose={onClose} title={station ? 'Printer tahrirlash' : 'Yangi printer stansiyasi'} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Printer nomi *</label>
          <input
            className="erp-input"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder='Masalan: "Shashlik printer", "Oshpaz printer", "Bar printer", "Dessert printer"'
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tavsif</label>
          <textarea
            className="erp-input"
            rows={2}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Masalan: Gril taomlar uchun printer, kassaga ulangan"
          />
        </div>

        {/* Auto-print toggle */}
        <div className={`rounded-xl p-4 border-2 ${form.autoPrint ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoPrint}
              onChange={e => setForm({ ...form, autoPrint: e.target.checked })}
              className="w-5 h-5 mt-0.5"
            />
            <div>
              <div className="font-semibold text-slate-900 flex items-center gap-2">
                ⚡ Avtomatik print
                {form.autoPrint && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Yoqilgan</span>}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Ofitsiant buyurtma bosganda, chek avtomatik shu printerdan chop etiladi.
                Kassir aralashmaydi — brauzer print dialogi avtomatik ochiladi.
              </p>
            </div>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Printer IP (ixtiyoriy)</label>
          <input
            className="erp-input font-mono text-sm"
            value={form.printerIp}
            onChange={e => setForm({ ...form, printerIp: e.target.value })}
            placeholder="192.168.1.100"
          />
          <p className="text-xs text-slate-500 mt-1">Local network printer IP manzili (Ethernet printer uchun)</p>
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
