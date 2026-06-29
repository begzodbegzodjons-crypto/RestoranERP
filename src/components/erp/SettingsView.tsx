'use client'

import { useState, useEffect } from 'react'
import { toast, api, formatMoney } from './utils'

type Restaurant = {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  currency: string
}

type Access = {
  state: 'trial' | 'active' | 'blocked'
  daysLeft: number
  endDate: string
  message: string
}

export default function SettingsView({
  restaurant,
  access,
  onLogout
}: {
  restaurant: Restaurant
  access: Access
  onLogout: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [serviceCharge, setServiceCharge] = useState(0)
  const [savingCharge, setSavingCharge] = useState(false)

  useEffect(() => {
    api('/api/staff/settings').then(r => setServiceCharge(r.serviceChargePercent || 0)).catch(() => {})
  }, [])

  const saveServiceCharge = async () => {
    setSavingCharge(true)
    try {
      await api('/api/staff/settings', {
        method: 'PUT',
        body: JSON.stringify({ serviceChargePercent: serviceCharge })
      })
      toast.success('Ofitsiant xizmati foizi saqlandi')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingCharge(false)
    }
  }

  const stateInfo = {
    trial: { label: 'Bepul sinov', cls: 'bg-amber-100 text-amber-700' },
    active: { label: 'Aktiv', cls: 'bg-emerald-100 text-emerald-700' },
    blocked: { label: 'Bloklangan', cls: 'bg-red-100 text-red-700' }
  }
  const info = stateInfo[access.state]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">⚙️ Sozlamalar</h2>
        <p className="text-slate-500 text-sm">Restoran ma'lumotlari va akkaunt holati</p>
      </div>

      {/* Subscription status */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-emerald-50 text-sm mb-1">Obuna holati</div>
            <div className="text-3xl font-bold">{info.label}</div>
            <div className="text-emerald-50 text-sm mt-2">{access.message}</div>
          </div>
          <div className="text-right">
            <div className="text-emerald-50 text-sm">Tugash sanasi</div>
            <div className="text-xl font-bold">{new Date(access.endDate).toLocaleDateString('uz-UZ')}</div>
            {access.daysLeft > 0 && <div className="text-emerald-50 text-sm mt-1">{access.daysLeft} kun qoldi</div>}
          </div>
        </div>
      </div>

      {/* Service charge settings */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-2">💼 Ofitsiant xizmati foizi</h3>
        <p className="text-slate-500 text-sm mb-4">
          Kassir to'lov qabul qilganda avtomatik shu foiz to'lovga qo'shiladi (ofitsiant xizmati uchun).
        </p>
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={serviceCharge}
                onChange={e => setServiceCharge(parseFloat(e.target.value) || 0)}
                className="erp-input pr-12"
                placeholder="0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">%</span>
            </div>
          </div>
          <button
            onClick={saveServiceCharge}
            disabled={savingCharge}
            className="px-6 py-3 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50 hover:bg-emerald-600"
          >
            {savingCharge ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Misol: 100,000 UZS buyurtma + 10% xizmat = <span className="font-semibold text-emerald-600">110,000 UZS</span>
        </div>
      </div>

      {/* Restaurant info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">🏪 Restoran ma'lumotlari</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow label="Restoran nomi" value={restaurant.name} />
          <InfoRow label="Email" value={restaurant.email} />
          <InfoRow label="Telefon" value={restaurant.phone || '—'} />
          <InfoRow label="Manzil" value={restaurant.address || '—'} />
          <InfoRow label="Valyuta" value={restaurant.currency} />
          <InfoRow label="ID" value={restaurant.id} mono />
        </div>
      </div>

      {/* Help */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-3">💬 Yordam va qo\'llab-quvvatlash</h3>
        <p className="text-slate-600 text-sm mb-4">
          Dastur bo'yicha savol yoki muammolar bo'lsa, telegram orqali bog'laning:
        </p>
        <a
          href="https://t.me/norinkomp"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
        >
          💬 Telegram: @norinkomp
        </a>
      </div>

      {/* Danger zone */}
      <div className="bg-red-50 rounded-2xl border border-red-200 p-6">
        <h3 className="font-bold text-red-900 mb-3">⚠️ Hisobdan chiqish</h3>
        <p className="text-red-700 text-sm mb-4">
          Tizimdan chiqib, boshqa akkauntga kirishingiz mumkin. Ma'lumotlaringiz saqlanib qoladi.
        </p>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="px-4 py-2 rounded-xl bg-white text-red-600 font-bold border border-red-200 hover:bg-red-100"
          >
            Chiqish
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600"
            >
              Ha, chiqish
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-4 py-2 rounded-xl bg-white text-slate-700 font-semibold border border-slate-200"
            >
              Bekor qilish
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`font-semibold text-slate-900 ${mono ? 'font-mono text-sm break-all' : ''}`}>{value}</div>
    </div>
  )
}
