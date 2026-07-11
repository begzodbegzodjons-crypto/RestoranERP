'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, formatDateTime } from './utils'

type Room = { id: string; name: string; floor?: number; color?: string | null }
type Table = { id: string; roomId: string; name: string; seats: number; status: 'free' | 'occupied' | 'reserved'; currentOrderId?: string | null; updatedAt?: string }

const STATUS_META: Record<Table['status'], { label: string; bg: string; dot: string }> = {
  free: { label: 'Bo\'sh', bg: 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100', dot: 'bg-emerald-500' },
  occupied: { label: 'Band', bg: 'bg-red-50 border-red-300 hover:bg-red-100', dot: 'bg-red-500' },
  reserved: { label: 'Bron', bg: 'bg-amber-50 border-amber-300 hover:bg-amber-100', dot: 'bg-amber-500' }
}
const NEXT: Record<Table['status'], Table['status']> = {
  free: 'occupied', occupied: 'reserved', reserved: 'free'
}

export default function FloorPlanView() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Table | null>(null)
  const [showTableForm, setShowTableForm] = useState(false)
  const [showRoomForm, setShowRoomForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [r, t] = await Promise.all([
        api<{ items: Room[] }>('/api/rooms'),
        api<{ items: Table[] }>('/api/tables')
      ])
      setRooms(r.items || []); setTables(t.items || [])
    } catch (e: any) { toast.error(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const cycleStatus = async (t: Table) => {
    const next = NEXT[t.status]
    try {
      await api(`/api/tables/${t.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) })
      toast.success(`${t.name}: ${STATUS_META[next].label}`); load()
    } catch (e: any) { toast.error(e.message) }
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

  const counts = tables.reduce((a, t) => { a[t.status] = (a[t.status] || 0) + 1; return a }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🗺️ Stol joylash rejasi</h2>
          <p className="text-slate-500 text-sm">
            Xona: <span className="font-semibold text-slate-700">{rooms.length}</span> •
            Stol: <span className="font-semibold text-slate-700">{tables.length}</span> •
            Bo\'sh: <span className="font-semibold text-emerald-600">{counts.free || 0}</span> •
            Band: <span className="font-semibold text-red-600">{counts.occupied || 0}</span> •
            Bron: <span className="font-semibold text-amber-600">{counts.reserved || 0}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTableForm(true)} className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/25">+ Yangi stol</button>
          <button onClick={() => setShowRoomForm(true)} className="px-4 py-2.5 rounded-xl bg-slate-700 text-white font-bold hover:bg-slate-800">+ Yangi xona</button>
        </div>
      </div>

      {rooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🏛️</div>
          Xonalar mavjud emas. Yangi xona qo\'shing.
        </div>
      ) : (
        <div className="space-y-4">
          {rooms.map(room => {
            const rt = tables.filter(t => t.roomId === room.id)
            return (
              <div key={room.id} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {room.color && <span className="w-3 h-3 rounded-full" style={{ background: room.color }} />}
                    <h3 className="font-bold text-slate-900 text-lg">{room.name}</h3>
                    {room.floor != null && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{room.floor}-qavat</span>}
                  </div>
                  <span className="text-sm text-slate-500">{rt.length} stol</span>
                </div>
                {rt.length === 0 ? (
                  <p className="text-slate-400 text-sm py-6 text-center">Bu xonada stollar yo\'q</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {rt.map(t => {
                      const meta = STATUS_META[t.status]
                      return (
                        <button key={t.id} onClick={() => setSelected(t)} className={`rounded-xl border-2 p-4 text-left transition-all ${meta.bg}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-900">{t.name}</span>
                            <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                          </div>
                          <div className="text-xs text-slate-600 font-medium">{meta.label}</div>
                          <div className="text-xs text-slate-400 mt-1">👥 {t.seats} kishi</div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <Modal open onClose={() => setSelected(null)} title={`Stol: ${selected.name}`} size="sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <span className={`w-3 h-3 rounded-full ${STATUS_META[selected.status].dot}`} />
              <div>
                <div className="text-xs text-slate-500">Joriy holat</div>
                <div className="font-bold text-slate-900">{STATUS_META[selected.status].label}</div>
              </div>
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              <div>👥 O\'rindiqlar: <span className="font-semibold">{selected.seats}</span></div>
              {selected.currentOrderId && <div>🧾 Buyurtma: <span className="font-mono text-xs">{selected.currentOrderId}</span></div>}
              {selected.updatedAt && <div>🕒 Yangilangan: <span className="font-medium">{formatDateTime(selected.updatedAt)}</span></div>}
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => cycleStatus(selected)} className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600">
                Holatni o\'zgartirish → {STATUS_META[NEXT[selected.status]].label}
              </button>
              <button onClick={() => { setShowTableForm(true); setSelected(null) }} className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Tahrirlash</button>
            </div>
          </div>
        </Modal>
      )}

      {showTableForm && (
        <TableForm rooms={rooms} onClose={() => { setShowTableForm(false); setSelected(null) }} onSaved={() => { setShowTableForm(false); setSelected(null); load() }} />
      )}
      {showRoomForm && <RoomForm onClose={() => setShowRoomForm(false)} onSaved={() => { setShowRoomForm(false); load() }} />}
    </div>
  )
}

function TableForm({ rooms, onClose }: { rooms: Room[]; onClose: () => void; onSaved: () => void }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id || '')
  const [name, setName] = useState('')
  const [seats, setSeats] = useState(4)
  const [status, setStatus] = useState<Table['status']>('free')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!roomId) { toast.error('Xonani tanlang'); return }
    if (!name.trim()) { toast.error('Stol nomini kiriting'); return }
    setSaving(true)
    try {
      await api('/api/tables', { method: 'POST', body: JSON.stringify({ roomId, name, seats, status }) })
      toast.success('Stol qo\'shildi'); onClose()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="Yangi stol">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Xona</label>
          <select className="erp-input" value={roomId} onChange={e => setRoomId(e.target.value)}>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Stol nomi</label>
          <input className="erp-input" value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: A1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">O\'rindiqlar</label>
            <input type="number" min={1} className="erp-input" value={seats} onChange={e => setSeats(parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Holat</label>
            <select className="erp-input" value={status} onChange={e => setStatus(e.target.value as Table['status'])}>
              <option value="free">Bo\'sh</option>
              <option value="occupied">Band</option>
              <option value="reserved">Bron</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50">{saving ? 'Saqlanmoqda...' : '✓ Saqlash'}</button>
        </div>
      </div>
    </Modal>
  )
}

function RoomForm({ onClose }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [floor, setFloor] = useState(1)
  const [color, setColor] = useState('#10b981')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) { toast.error('Xona nomini kiriting'); return }
    setSaving(true)
    try {
      await api('/api/rooms', { method: 'POST', body: JSON.stringify({ name, floor, color }) })
      toast.success('Xona qo\'shildi'); onClose()
    } catch (e: any) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="Yangi xona">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Xona nomi</label>
          <input className="erp-input" value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: Asosiy zal" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Qavat</label>
            <input type="number" min={0} className="erp-input" value={floor} onChange={e => setFloor(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Rang</label>
            <input type="color" className="erp-input h-[42px] p-1" value={color} onChange={e => setColor(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50">{saving ? 'Saqlanmoqda...' : '✓ Saqlash'}</button>
        </div>
      </div>
    </Modal>
  )
}
