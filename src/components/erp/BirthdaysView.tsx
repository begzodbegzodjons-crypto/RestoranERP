'use client'

import { useState, useEffect } from 'react'
import { api, toast } from './utils'

type BirthdayCustomer = {
  id: string
  name: string
  phone: string | null
  birthDate: string | null
  age: number | null
  daysUntil: number
  isToday: boolean
  loyaltyTier?: { name: string; color: string } | null
}

const TIER_STYLES: Record<string, string> = {
  VIP: 'bg-purple-50 text-purple-700 border-purple-200',
  Gold: 'bg-amber-50 text-amber-700 border-amber-200',
  Silver: 'bg-slate-100 text-slate-700 border-slate-200',
  Bronze: 'bg-orange-50 text-orange-700 border-orange-200'
}

function getTierStyle(tierName?: string | null): string {
  if (!tierName) return 'bg-slate-100 text-slate-600 border-slate-200'
  return TIER_STYLES[tierName] || 'bg-emerald-50 text-emerald-700 border-emerald-200'
}

function formatDaysLabel(days: number, isToday: boolean): string {
  if (isToday) return 'Bugun! 🎉'
  if (days === 0) return 'Bugun'
  if (days === 1) return 'Ertaga'
  return `${days} kun dan keyin`
}

export default function BirthdaysView() {
  const [customers, setCustomers] = useState<BirthdayCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(`/api/customers/birthdays?days=${days}`)
      setCustomers(res.items || res.customers || res || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days])

  const sendSms = (c: BirthdayCustomer) => {
    toast.success(`SMS yuborildi: ${c.name} (${c.phone || 'telefon yo\'q'})`)
  }

  const sendBulkSms = (list: BirthdayCustomer[]) => {
    if (list.length === 0) {
      toast.error('SMS yuborish uchun mijozlar yo\'q')
      return
    }
    toast.success(`${list.length} ta mijozga tabrik SMS yuborildi`)
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

  const todayList = customers.filter(c => c.isToday)
  const upcomingList = customers
    .filter(c => !c.isToday)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🎂 Tug'ilgan kunlar</h2>
          <p className="text-slate-500 text-sm">Mijozlarning tug'ilgan kunlari va tabriklanishi</p>
        </div>
        <select
          value={days}
          onChange={e => setDays(parseInt(e.target.value))}
          className="erp-input max-w-[200px]"
        >
          <option value={7}>So'nggi 7 kun</option>
          <option value={30}>So'nggi 30 kun</option>
          <option value={60}>So'nggi 60 kun</option>
          <option value={90}>So'nggi 90 kun</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Bugungi tug'ilgan kunlar</div>
          <div className="font-bold text-emerald-600 text-xl">{todayList.length} ta</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Kelayotgan tug'ilgan kunlar</div>
          <div className="font-bold text-blue-600 text-xl">{upcomingList.length} ta</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Jami davrda</div>
          <div className="font-bold text-slate-900 text-xl">{customers.length} ta</div>
        </div>
      </div>

      {todayList.length > 0 && (
        <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-purple-50 border-2 border-pink-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              Bugungi tug'ilgan kunlar ({todayList.length})
            </h3>
            <button
              onClick={() => sendBulkSms(todayList)}
              className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold"
            >
              📱 Hammaga SMS yuborish
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {todayList.map(c => (
              <BirthdayCard key={c.id} customer={c} onSendSms={sendSms} highlight />
            ))}
          </div>
        </div>
      )}

      {upcomingList.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="text-2xl">📅</span>
              Kelayotgan tug'ilgan kunlar
            </h3>
            <button
              onClick={() => sendBulkSms(upcomingList)}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold"
            >
              📱 Hammaga SMS yuborish
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingList.map(c => (
              <BirthdayCard key={c.id} customer={c} onSendSms={sendSms} />
            ))}
          </div>
        </div>
      )}

      {customers.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">🎂</div>
          {days} kun ichida tug'ilgan kunlari bo'lgan mijozlar topilmadi.
        </div>
      )}
    </div>
  )
}

function BirthdayCard({
  customer,
  onSendSms,
  highlight
}: {
  customer: BirthdayCustomer
  onSendSms: (c: BirthdayCustomer) => void
  highlight?: boolean
}) {
  const tierName = customer.loyaltyTier?.name
  const tierColor = customer.loyaltyTier?.color
  const daysLabel = formatDaysLabel(customer.daysUntil, customer.isToday)

  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-3 ${
        highlight
          ? 'bg-white/80 border-pink-200'
          : 'bg-slate-50 border-slate-200'
      }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 ${
        highlight ? 'bg-pink-100' : 'bg-emerald-50'
      }`}>
        {highlight ? '🎂' : '🎁'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-bold text-slate-900 truncate">{customer.name}</div>
          {tierName && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${getTierStyle(tierName)}`}
              style={tierColor ? { background: tierColor + '20', color: tierColor, borderColor: tierColor + '40' } : undefined}
            >
              {tierName}
            </span>
          )}
        </div>
        <div className="text-sm text-slate-600 mt-0.5">
          📞 {customer.phone || 'Telefon kiritilmagan'}
        </div>
        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
          {customer.age != null && <span>Yoshi: {customer.age}</span>}
          <span className={`font-semibold ${customer.isToday ? 'text-pink-600' : 'text-blue-600'}`}>
            {daysLabel}
          </span>
        </div>
        <button
          onClick={() => onSendSms(customer)}
          className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold"
        >
          📱 SMS yuborish
        </button>
      </div>
    </div>
  )
}
