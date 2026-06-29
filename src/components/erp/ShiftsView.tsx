'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatMoney, formatDateTime, Modal, useConfirm } from './utils'

type Shift = {
  id: string
  status: string
  openingCash: number
  expectedCash: number
  closingCash: number
  cashDiff: number
  totalSales: number
  cashSales: number
  cardSales: number
  transferSales: number
  orderCount: number
  openedAt: string
  closedAt: string | null
  notes: string | null
  staff: { name: string }
}

export default function ShiftsView() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [openingCash, setOpeningCash] = useState(0)
  const [closingCash, setClosingCash] = useState(0)
  const [closeNotes, setCloseNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [zReport, setZReport] = useState<any | null>(null)
  const { confirm, dialog } = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/shifts')
      setShifts(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openShift = async () => {
    setProcessing(true)
    try {
      await api('/api/shifts', {
        method: 'POST',
        body: JSON.stringify({ openingCash })
      })
      toast.success('Smena ochildi!')
      setOpenModal(false)
      setOpeningCash(0)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setProcessing(false)
    }
  }

  const closeShift = async () => {
    if (!(await confirm('Smenani yopishni tasdiqlaysizmi? Z-otchet tayyorlanadi.'))) return
    setProcessing(true)
    try {
      const res = await api('/api/shifts/close', {
        method: 'POST',
        body: JSON.stringify({ closingCash, notes: closeNotes })
      })
      setZReport(res.zReport)
      setCloseModal(false)
      setClosingCash(0)
      setCloseNotes('')
      toast.success('Smena yopildi! Z-otchet tayyor.')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setProcessing(false)
    }
  }

  const hasOpenShift = shifts.some(s => s.status === 'open')
  const currentShift = shifts.find(s => s.status === 'open')

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
          <h2 className="text-2xl font-bold text-slate-900">💰 Kassir smenalari</h2>
          <p className="text-slate-500 text-sm">Smena ochish/yopish va Z-otchet</p>
        </div>
        {hasOpenShift ? (
          <button
            onClick={() => setCloseModal(true)}
            className="px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/25 hover:bg-red-600"
          >
            🔒 Smenani yopish (Z-otchet)
          </button>
        ) : (
          <button
            onClick={() => setOpenModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25"
          >
            🔓 Smena ochish
          </button>
        )}
      </div>

      {/* Current shift status */}
      {currentShift && (
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <div className="text-emerald-50 text-sm">Joriy smena</div>
              <div className="text-2xl font-bold">✓ Ochiq</div>
            </div>
            <div className="text-right">
              <div className="text-emerald-50 text-sm">Kassir</div>
              <div className="font-bold">{currentShift.staff.name}</div>
              <div className="text-xs text-emerald-50">{formatDateTime(currentShift.openedAt)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="bg-white/15 rounded-xl p-3">
              <div className="text-xs text-emerald-50">Boshlang'ich naqd</div>
              <div className="font-bold">{formatMoney(currentShift.openingCash)}</div>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <div className="text-xs text-emerald-50">Buyurtmalar</div>
              <div className="font-bold">{currentShift.orderCount} ta</div>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <div className="text-xs text-emerald-50">Jami savdo</div>
              <div className="font-bold">{formatMoney(currentShift.totalSales)}</div>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <div className="text-xs text-emerald-50">Kutilayotgan naqd</div>
              <div className="font-bold">{formatMoney(currentShift.expectedCash)}</div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">Smenalar tarixi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Kassir</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Ochilgan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Yopilgan</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Bosh. naqd</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Naqd savdo</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Karta</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Jami</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Farq</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shifts.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Smenalar yo'q</td></tr>
              )}
              {shifts.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.staff.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(s.openedAt)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{s.closedAt ? formatDateTime(s.closedAt) : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatMoney(s.openingCash)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatMoney(s.cashSales)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatMoney(s.cardSales)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatMoney(s.totalSales)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${s.cashDiff > 0 ? 'text-emerald-600' : s.cashDiff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {s.cashDiff > 0 ? '+' : ''}{formatMoney(s.cashDiff)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.status === 'open' ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Ochiq</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Yopilgan</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open shift modal */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="🔓 Smena ochish" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Kassada qancha naqd pul bor? (boshlang'ich summa)</p>
          <input
            type="number"
            value={openingCash || ''}
            onChange={e => setOpeningCash(parseFloat(e.target.value) || 0)}
            className="erp-input text-2xl font-bold text-center"
            placeholder="0"
          />
          <div className="flex gap-3">
            <button onClick={() => setOpenModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold">Bekor</button>
            <button onClick={openShift} disabled={processing} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50">
              {processing ? 'Ochilmoqda...' : '✓ Smena ochish'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Close shift modal */}
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="🔒 Smenani yopish (Z-otchet)" size="md">
        <div className="space-y-4">
          {currentShift && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-slate-600">Boshlang'ich naqd:</span><span className="font-semibold">{formatMoney(currentShift.openingCash)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Naqd savdo:</span><span className="font-semibold">{formatMoney(currentShift.cashSales)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600">Kutilayotgan naqd:</span><span className="font-bold text-emerald-600">{formatMoney(currentShift.expectedCash)}</span></div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Haqiqiy naqd (sanyoq)</label>
            <input
              type="number"
              value={closingCash || ''}
              onChange={e => setClosingCash(parseFloat(e.target.value) || 0)}
              className="erp-input text-xl font-bold text-center"
              placeholder="0"
            />
            <p className="text-xs text-slate-500 mt-1">Kassada qancha naqd qoldi - sanyoq natijasi</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Izoh (ixtiyoriy)</label>
            <textarea
              value={closeNotes}
              onChange={e => setCloseNotes(e.target.value)}
              className="erp-input"
              rows={2}
              placeholder="Masalan: smena davomida muommolar..."
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCloseModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold">Bekor</button>
            <button onClick={closeShift} disabled={processing} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold disabled:opacity-50">
              {processing ? 'Yopilmoqda...' : '🔒 Yopish + Z-otchet'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Z-Report modal */}
      {zReport && (
        <Modal open onClose={() => setZReport(null)} title="🧾 Z-otchet" size="md">
          <div className="space-y-3">
            <div className="bg-slate-900 text-white rounded-xl p-4 text-center">
              <div className="text-xs text-slate-400">Z-OTCHET</div>
              <div className="text-2xl font-bold">{formatMoney(zReport.totalSales)}</div>
              <div className="text-xs text-slate-400">Jami savdo</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Kassir:</span><span className="font-semibold">{zReport.cashier}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Ochilgan:</span><span>{formatDateTime(zReport.openedAt)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Yopilgan:</span><span>{formatDateTime(zReport.closedAt)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Buyurtmalar soni:</span><span className="font-semibold">{zReport.orderCount}</span></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <div className="text-xs text-emerald-700">Naqd</div>
                <div className="font-bold text-emerald-900">{formatMoney(zReport.cashSales)}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xs text-blue-700">Karta</div>
                <div className="font-bold text-blue-900">{formatMoney(zReport.cardSales)}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-xs text-purple-700">O'tkazma</div>
                <div className="font-bold text-purple-900">{formatMoney(zReport.transferSales)}</div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Boshlang'ich naqd:</span><span>{formatMoney(zReport.openingCash)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">+ Naqd savdo:</span><span>{formatMoney(zReport.cashSales)}</span></div>
              <div className="flex justify-between font-bold"><span>Kutilayotgan naqd:</span><span>{formatMoney(zReport.expectedCash)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Haqiqiy naqd:</span><span>{formatMoney(zReport.closingCash)}</span></div>
              <div className={`flex justify-between font-bold text-lg pt-2 border-t border-slate-200 ${zReport.cashDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                <span>{zReport.cashDiff >= 0 ? 'Ortiqcha:' : "Yo'qotish:"}</span>
                <span>{formatMoney(Math.abs(zReport.cashDiff))}</span>
              </div>
            </div>
            <button onClick={() => setZReport(null)} className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold">Yopish</button>
          </div>
        </Modal>
      )}

      {dialog}
    </div>
  )
}
