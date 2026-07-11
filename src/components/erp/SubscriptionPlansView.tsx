'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatMoney } from './utils'

type Plan = {
  id: string
  name: string
  description?: string | null
  priceMonthly: number
  priceYearly: number
  maxProducts: number
  maxStaff: number
  maxBranches: number
  features: string[]
  color?: string | null
  isPopular?: boolean
}

type RestaurantInfo = {
  subscriptionPlan?: string | { id: string; name: string } | null
  subscriptionStatus?: string
}

const PLAN_STYLES: Record<string, { gradient: string; ring: string; badge: string; icon: string }> = {
  Basic: {
    gradient: 'from-slate-500 to-slate-600',
    ring: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-700',
    icon: '🌱'
  },
  Pro: {
    gradient: 'from-emerald-500 to-teal-600',
    ring: 'border-emerald-300 ring-2 ring-emerald-100',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: '🚀'
  },
  Enterprise: {
    gradient: 'from-purple-600 to-indigo-700',
    ring: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    icon: '👑'
  }
}

const getStyle = (name: string) =>
  PLAN_STYLES[name] || { gradient: 'from-slate-500 to-slate-600', ring: 'border-slate-200', badge: 'bg-slate-100 text-slate-700', icon: '⭐' }

const getPlanId = (p: Plan | { id: string; name: string } | string | null | undefined): string => {
  if (!p) return ''
  if (typeof p === 'string') return p
  return p.id
}

export default function SubscriptionPlansView() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [restaurant, setRestaurant] = useState<RestaurantInfo>({})
  const [loading, setLoading] = useState(true)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')

  const load = async () => {
    setLoading(true)
    try {
      const [plansRes, restRes] = await Promise.all([
        api('/api/subscription-plans'),
        api('/api/restaurant').catch(() => ({}))
      ])
      setPlans(plansRes.items || plansRes || [])
      setRestaurant(restRes || {})
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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

  const currentPlanId = getPlanId(restaurant.subscriptionPlan)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">💳 Obuna tariflari</h2>
          <p className="text-slate-500 text-sm">Restoraningiz uchun mos tarifni tanlang</p>
        </div>
        <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${billing === 'monthly' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Oylik
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${billing === 'yearly' ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Yillik
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">-20%</span>
          </button>
        </div>
      </div>

      {restaurant.subscriptionStatus && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div className="flex-1">
            <div className="text-sm text-slate-500">Joriy obuna holati</div>
            <div className="font-bold text-slate-900 capitalize">{restaurant.subscriptionStatus}</div>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
            Faol
          </span>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">💳</div>
          Tariflar topilmadi
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map(plan => {
            const style = getStyle(plan.name)
            const isCurrent = !!(currentPlanId && currentPlanId === plan.id)
            const price = billing === 'monthly' ? plan.priceMonthly : plan.priceYearly
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border-2 p-6 relative flex flex-col ${style.ring} ${
                  isCurrent ? 'ring-2 ring-emerald-300 border-emerald-300' : ''
                }`}
              >
                {plan.isPopular && !isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-amber-400 to-orange-500">
                    🔥 Mashhur
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600">
                    ✓ Joriy tarif
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-2xl`}>
                    {style.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-xs text-slate-500 line-clamp-1">{plan.description}</p>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900">{formatMoney(price)}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {billing === 'monthly' ? 'oyiga' : 'yiliga'}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-xs text-slate-500">Mahsulot</div>
                    <div className="font-bold text-slate-900 text-sm">
                      {plan.maxProducts === -1 ? '∞' : plan.maxProducts}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-xs text-slate-500">Xodim</div>
                    <div className="font-bold text-slate-900 text-sm">
                      {plan.maxStaff === -1 ? '∞' : plan.maxStaff}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-xs text-slate-500">Filial</div>
                    <div className="font-bold text-slate-900 text-sm">
                      {plan.maxBranches === -1 ? '∞' : plan.maxBranches}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex-1">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Imkoniyatlar</div>
                  <ul className="space-y-2">
                    {(plan.features || []).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                    {(!plan.features || plan.features.length === 0) && (
                      <li className="text-sm text-slate-400">Imkoniyatlar ro'yxati kiritilmagan</li>
                    )}
                  </ul>
                </div>

                <button
                  disabled={isCurrent}
                  onClick={() => toast.info(`"${plan.name}" tarifiga o'tish uchun administrator bilan bog'laning`)}
                  className={`mt-6 w-full px-4 py-2.5 rounded-xl font-bold transition-all ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : `bg-gradient-to-r ${style.gradient} text-white hover:shadow-lg`
                  }`}
                >
                  {isCurrent ? '✓ Joriy tarif' : 'Tarifni tanlash'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl shrink-0">💡</span>
        <p className="text-sm text-blue-800">
          Tarifni o'zgartirish uchun yoki yillik to'lov bo'yicha qo'shimcha chegirma olish uchun
          qo'llab-quvvatlash markazi bilan bog'laning. Yillik to'lovda 20% chegirma beriladi.
        </p>
      </div>
    </div>
  )
}
