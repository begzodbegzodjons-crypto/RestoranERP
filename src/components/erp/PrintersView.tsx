'use client'

import { useState, useEffect } from 'react'
import { api, toast, Modal, useConfirm, formatDateTime } from './utils'

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
  const [tab, setTab] = useState<'printers' | 'queue'>('printers')
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🖨️ Printer sozlamalari</h2>
          <p className="text-slate-500 text-sm">
            Printerlar, kategoriya bog'lash, print navbati — hammasi bir joyda
          </p>
        </div>
        {tab === 'printers' && (
          <button
            onClick={() => { setEditing(null); setModal(true) }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25"
          >
            ➕ Printer qo'shish
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
        <button
          onClick={() => setTab('printers')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold ${tab === 'printers' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          🖨️ Printerlar
        </button>
        <button
          onClick={() => setTab('queue')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold ${tab === 'queue' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          📋 Print navbati
        </button>
      </div>

      {tab === 'printers' && <PrintersTab
        stations={stations}
        categories={categories}
        loading={loading}
        reorder={reorder}
        del={del}
        toggleAutoPrint={toggleAutoPrint}
        assignCategory={assignCategory}
        setEditing={setEditing}
        setModal={setModal}
        setReassignCat={setReassignCat}
        setReassignModal={setReassignModal}
      />}

      {tab === 'queue' && <PrintQueueTab />}

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

// ============== PRINTERS TAB ==============
function PrintersTab({ stations, categories, loading, reorder, del, toggleAutoPrint, assignCategory, setEditing, setModal, setReassignCat, setReassignModal }: any) {
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

      {/* Printer stations */}
      <div className="space-y-3">
        {stations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <div className="text-5xl mb-3">🖨️</div>
            Printer stansiyalari yo'q. Birinchi printerni qo'shing!
          </div>
        ) : (
          stations.map((s: PrinterStation, idx: number) => {
            const assignedCats = categories.filter((c: Category) => c.printerStationId === s.id)
            return (
              <div key={s.id} className={`bg-white rounded-2xl border-2 ${s.autoPrint ? 'border-emerald-200' : 'border-slate-200'} overflow-hidden`}>
                <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => reorder(s.id, 'up')} disabled={idx === 0} className="w-7 h-5 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-30 flex items-center justify-center text-xs" title="Yuqoriga">▲</button>
                      <button onClick={() => reorder(s.id, 'down')} disabled={idx === stations.length - 1} className="w-7 h-5 rounded bg-slate-600 hover:bg-slate-500 disabled:opacity-30 flex items-center justify-center text-xs" title="Pastga">▼</button>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                    <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center text-2xl">🖨️</div>
                    <div>
                      <div className="font-bold text-lg flex items-center gap-2">
                        {s.name}
                        {s.autoPrint ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500 text-white">⚡ Avto</span> : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500 text-white">Qo'lda</span>}
                      </div>
                      {s.description && <div className="text-xs text-slate-300">{s.description}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleAutoPrint(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${s.autoPrint ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-600 hover:bg-slate-500'} text-white`}>
                      {s.autoPrint ? '⚡ Avto yoqilgan' : "⚡ Avto o'chiq"}
                    </button>
                    <button onClick={() => { setEditing(s); setModal(true) }} className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium">✏️ Tahrirlash</button>
                    <button onClick={() => del(s)} className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium">🗑️ O'chirish</button>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-slate-700">📎 Bog'langan kategoriyalar ({assignedCats.length})</div>
                    <div className="text-xs text-slate-500">{s._count?.printJobs || 0} ta print job tarixda</div>
                  </div>
                  {assignedCats.length === 0 ? (
                    <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-400 text-sm">
                      Bu printerga hozircha kategoriya bog'lanmagan. Pastdagi jadvaldan kategoriyani tanlab bog'lang.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {assignedCats.map((c: Category) => (
                        <div key={c.id} className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm">🏷️</span>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 text-sm truncate">{c.name}</div>
                              <div className="text-xs text-slate-500">{c._count?.products || 0} ta taom</div>
                            </div>
                          </div>
                          <button onClick={() => { setReassignCat(c); setReassignModal(true) }} className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0 px-1" title="Boshqa printerga ko'chirish">🔄</button>
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
            <p className="text-xs text-slate-500">Agar kategoriya noto'g'ri printerga bog'langan bo'lsa — dropdown dan o'zgartiring</p>
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
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Kategoriyalar yo'q.</td></tr>
                ) : (
                  categories.map((c: Category) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{c._count?.products || 0}</td>
                      <td className="px-4 py-3">
                        {c.printerStation ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100">🖨️ {c.printerStation.name}</span>
                        ) : (
                          <span className="text-slate-400 text-sm">— Printer yo'q —</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select value={c.printerStationId || ''} onChange={e => assignCategory(c.id, e.target.value)} className="erp-input max-w-[200px] text-sm">
                          <option value="">— Printer yo'q —</option>
                          {stations.map((s: PrinterStation) => (<option key={s.id} value={s.id}>🖨️ {s.name}</option>))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => { setReassignCat(c); setReassignModal(true) }} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">🔄 Ko'chirish</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unassigned categories warning */}
      {categories.some((c: Category) => !c.printerStationId) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="font-semibold text-amber-900 mb-1">⚠️ Bog'lanmagan kategoriyalar</div>
          <p className="text-sm text-amber-800">
            {categories.filter((c: Category) => !c.printerStationId).map((c: Category) => c.name).join(', ')} — bu kategoriyalardagi taomlar uchun chek chiqmaydi. Yuqoridagi jadvaldan printerga bog'lang.
          </p>
        </div>
      )}
    </div>
  )
}

// ============== PRINT QUEUE TAB ==============
function PrintQueueTab() {
  const [groups, setGroups] = useState<any[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res = await api('/api/print-jobs?status=pending')
      setGroups(res.items || [])
      setPendingCount(res.pendingCount || 0)
    } catch (e: any) {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const printJob = (job: any, stationName: string) => {
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) { toast.error('Pop-up bloklangan.'); return }
    const c = job.content
    const itemsHtml = c.items.map((it: any) => `
      <tr><td style="padding:3px 0;font-size:14px;font-weight:bold;">${it.quantity}×</td>
      <td style="padding:3px 0;font-size:14px;">${it.productName}${it.notes ? `<br><small style="color:#666;">📝 ${it.notes}</small>` : ''}</td></tr>
    `).join('')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${stationName} - ${c.table}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;padding:8px;width:80mm;color:#000}.center{text-align:center}.header{font-size:16px;font-weight:bold;margin-bottom:5px}.station{font-size:12px;color:#666;margin-bottom:8px}.info{font-size:12px;margin-bottom:8px}.info div{padding:1px 0}hr{border:0;border-top:1px dashed #000;margin:5px 0}table{width:100%;font-size:14px}td{vertical-align:top}</style></head>
    <body><div class="center header">${stationName}</div><div class="center station">${c.items.length} ta buyurtma</div><hr>
    <div class="info"><div><b>Stol:</b> ${c.table}</div><div><b>Ofitsiant:</b> ${c.waiter}</div><div><b>Buyurtma #:</b> ${c.orderNo}</div><div><b>Vaqt:</b> ${new Date(c.createdAt).toLocaleString('uz-UZ')}</div></div><hr>
    <table>${itemsHtml}</table><hr><div class="center" style="font-size:11px;margin-top:8px">*** ${stationName} ***</div>
    <script>window.onload=function(){window.print();setTimeout(function(){window.close()},1000)}</script></body></html>`)
    win.document.close()
  }

  const printAll = (group: any) => {
    group.jobs.forEach((job: any, i: number) => { setTimeout(() => printJob(job, group.station.name), i * 1500) })
    toast.success(`${group.station.name}: ${group.jobs.length} ta chek chop etilmoqda...`)
  }

  const markPrinted = async (jobId: string) => {
    try { await api(`/api/print-jobs/${jobId}/printed`, { method: 'POST' }); load() } catch {}
  }

  const markAllPrinted = async (group: any) => {
    for (const job of group.jobs) { await markPrinted(job.id) }
    toast.success(`${group.station.name}: barchasi chop etilgan`)
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
        <div className="text-sm text-slate-500">
          {pendingCount > 0 ? `⚠️ ${pendingCount} ta chop etilmagan chek` : '✓ Barcha cheklar chop etilgan'} • Har 5 soniyada yangilanadi
        </div>
        <button onClick={load} className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 text-sm">↻ Yangilash</button>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">✓</div>
          Chop etilmagan cheklar yo'q. Ofitsiantlar buyurtma bosganda, cheklar shu yerda paydo bo'ladi.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group: any) => (
            <div key={group.station.id} className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
              <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🖨️</span>
                  <div>
                    <div className="font-bold text-lg">{group.station.name}</div>
                    {group.station.description && <div className="text-xs text-slate-300">{group.station.description}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-amber-500">{group.jobs.length} ta kutilmoqda</span>
                  <button onClick={() => printAll(group)} className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm">🖨️ Hammasini chop etish</button>
                  <button onClick={() => markAllPrinted(group)} className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-medium text-sm">✓ Chop etilgan</button>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {group.jobs.map((job: any) => (
                  <div key={job.id} className="p-4 hover:bg-slate-50 flex items-start gap-4">
                    <div className="flex-shrink-0 w-20 text-center">
                      <div className="bg-slate-900 text-white rounded-lg py-2 px-3">
                        <div className="text-xs text-slate-300">Stol</div>
                        <div className="font-bold text-lg">{job.content.table}</div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-500">{job.content.orderNo}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{job.content.waiter}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{formatDateTime(job.createdAt)}</span>
                      </div>
                      <div className="space-y-0.5">
                        {job.content.items.map((it: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-emerald-600 w-8">{it.quantity}×</span>
                            <span className="font-medium text-slate-900">{it.productName}</span>
                            {it.notes && <span className="text-xs text-amber-600 italic">📝 {it.notes}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => printJob(job, group.station.name)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800">🖨️ Chop etish</button>
                      <button onClick={() => markPrinted(job.id)} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100">✓ Tayyor</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============== PRINTER FORM ==============
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
          <input className="erp-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='Masalan: "Shashlik printer", "Oshpaz printer", "Bar printer"' />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tavsif</label>
          <textarea className="erp-input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Masalan: Gril taomlar uchun printer" />
        </div>
        <div className={`rounded-xl p-4 border-2 ${form.autoPrint ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.autoPrint} onChange={e => setForm({ ...form, autoPrint: e.target.checked })} className="w-5 h-5 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900 flex items-center gap-2">
                ⚡ Avtomatik print
                {form.autoPrint && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Yoqilgan</span>}
              </div>
              <p className="text-xs text-slate-600 mt-1">Ofitsiant buyurtma bosganda, chek avtomatik shu printerdan chop etiladi. Kassir aralashmaydi.</p>
            </div>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Printer IP <span className="text-slate-400 font-normal">(ixtiyoriy - faqat IP printerlar uchun)</span></label>
          <input className="erp-input font-mono text-sm" value={form.printerIp} onChange={e => setForm({ ...form, printerIp: e.target.value })} placeholder="192.168.1.100 (USB uchun bo'sh qoldiring)" />
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-900">
              <strong>💡 Eslatma:</strong> USB orqali ulangan printerlar uchun bu maydonni <strong>BO'SH</strong> qoldiring.
              USB printer'ni "🖨️ POS Print Monitor" bo'limida ulaysiz.
              <br/>
              <strong>IP printer</strong> (network printer) uchun esa IP manzilni kiriting (masalan: 192.168.1.100).
            </p>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50">{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button>
        </div>
      </div>
    </Modal>
  )
}
