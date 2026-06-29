'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatDateTime } from './utils'

type Notification = {
  id: string
  type: string
  title: string
  message: string
  audience: string
  isRead: boolean
  createdAt: string
}

const TYPE_META: Record<string, { icon: string; color: string }> = {
  new_order: { icon: '🛒', color: 'bg-blue-50 border-blue-200' },
  low_stock: { icon: '⚠️', color: 'bg-amber-50 border-amber-200' },
  shift_closed: { icon: '💰', color: 'bg-emerald-50 border-emerald-200' },
  reservation: { icon: '📅', color: 'bg-purple-50 border-purple-200' },
  payment: { icon: '💳', color: 'bg-emerald-50 border-emerald-200' },
  debt: { icon: '💳', color: 'bg-red-50 border-red-200' },
  kitchen_ready: { icon: '🍳', color: 'bg-orange-50 border-orange-200' }
}

export default function NotificationsView() {
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/notifications')
      setItems(res.items || [])
      setUnreadCount(res.unreadCount || 0)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const markRead = async (id: string) => {
    try {
      await api(`/api/notifications/${id}/read`, { method: 'POST' })
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const markAllRead = async () => {
    for (const n of items.filter(i => !i.isRead)) {
      await markRead(n.id)
    }
  }

  const filtered = filter === 'unread' ? items.filter(i => !i.isRead) : items

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
          <h2 className="text-2xl font-bold text-slate-900">🔔 Bildirishnomalar</h2>
          <p className="text-slate-500 text-sm">{unreadCount} ta o'qilmagan • {items.length} ta jami</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded text-sm font-medium ${filter === 'all' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}>Hammasi</button>
            <button onClick={() => setFilter('unread')} className={`px-3 py-1.5 rounded text-sm font-medium ${filter === 'unread' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}>O'qilmagan ({unreadCount})</button>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100">
              ✓ Hammasini o'qilgan deb belgilash
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🔔</div>
          Bildirishnomalar yo'q
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const meta = TYPE_META[n.type] || { icon: '📢', color: 'bg-slate-50 border-slate-200' }
            return (
              <div
                key={n.id}
                className={`bg-white rounded-xl border ${n.isRead ? 'border-slate-200 opacity-60' : meta.color + ' border-2'} p-4 flex items-start gap-3 cursor-pointer hover:shadow-sm`}
                onClick={() => !n.isRead && markRead(n.id)}
              >
                <div className="text-2xl">{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900">{n.title}</div>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5"></span>}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{n.message}</div>
                  <div className="text-xs text-slate-400 mt-2">{formatDateTime(n.createdAt)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
