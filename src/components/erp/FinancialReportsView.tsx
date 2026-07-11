'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, formatDateTime } from './utils'

type ReportType = 'pl' | 'cashflow' | 'summary'

type ReportData = {
  type: ReportType
  period: { from: string; to: string }
  // P&L
  revenue?: number
  costOfGoods?: number
  grossProfit?: number
  operatingExpenses?: Array<{ category: string; amount: number }>
  totalOperatingExpenses?: number
  operatingProfit?: number
  otherIncome?: number
  otherExpenses?: number
  netProfit?: number
  // Cash flow
  openingBalance?: number
  closingBalance?: number
  operatingActivities?: Array<{ label: string; amount: number }>
  investingActivities?: Array<{ label: string; amount: number }>
  financingActivities?: Array<{ label: string; amount: number }>
  netCashFlow?: number
  // Summary
  summary?: Array<{ label: string; value: number; type: 'money' | 'number' }>
}

const TABS: Array<{ value: ReportType; label: string; icon: string }> = [
  { value: 'pl', label: 'Foyda & Zarar', icon: '📈' },
  { value: 'cashflow', label: 'Pul oqimi', icon: '💧' },
  { value: 'summary', label: 'Umumiy', icon: '📊' }
]

export default function FinancialReportsView() {
  const [tab, setTab] = useState<ReportType>('pl')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))

  const load = async () => {
    setLoading(true)
    try {
      const res = await api<ReportData>(`/api/financial-reports?type=${tab}&from=${from}&to=${to}`)
      setData(res)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tab])

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
      <div>
        <h2 className="text-2xl font-bold text-slate-900">💼 Moliyaviy hisobotlar</h2>
        <p className="text-slate-500 text-sm">Foyda-zarar, pul oqimi va umumiy hisobotlar</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-2 flex flex-wrap gap-1">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${
              tab === t.value ? 'bg-emerald-500 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Dan</label>
          <input type="date" className="erp-input" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Gacha</label>
          <input type="date" className="erp-input" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button
          onClick={load}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600"
        >
          Yangilash
        </button>
      </div>

      {!data ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          Hisobot ma\'lumotlari yo\'q
        </div>
      ) : tab === 'pl' ? (
        <PnLReport data={data} />
      ) : tab === 'cashflow' ? (
        <CashFlowReport data={data} />
      ) : (
        <SummaryReport data={data} />
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Row({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${strong ? 'border-t border-slate-200 mt-2 pt-3' : ''}`}>
      <span className={`text-sm ${muted ? 'text-slate-500 pl-4' : 'text-slate-700'} ${strong ? 'font-bold text-slate-900' : ''}`}>
        {label}
      </span>
      <span className={`text-sm font-medium ${strong ? 'text-slate-900 text-base font-bold' : 'text-slate-900'}`}>
        {formatMoney(value)}
      </span>
    </div>
  )
}

function PnLReport({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4">
      <Section title="Foyda va zarar hisoboti">
        <Row label="Tushum" value={data.revenue || 0} />
        <Row label="Sotilgan tovarning qiymati (COGS)" value={-(data.costOfGoods || 0)} muted />
        <Row label="Yalpi foyda" value={data.grossProfit || 0} strong />
        {data.operatingExpenses?.map((e, i) => (
          <Row key={i} label={e.category} value={-e.amount} muted />
        ))}
        <Row label="Jami operatsion xarajatlar" value={-(data.totalOperatingExpenses || 0)} muted />
        <Row label="Operatsion foyda" value={data.operatingProfit || 0} strong />
        <Row label="Boshqa daromadlar" value={data.otherIncome || 0} muted />
        <Row label="Boshqa xarajatlar" value={-(data.otherExpenses || 0)} muted />
        <Row label="Sof foyda" value={data.netProfit || 0} strong />
      </Section>
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-5">
        <div className="flex items-center justify-between">
          <div className="text-slate-700">
            <div className="text-xs uppercase font-semibold opacity-70">Davrdagi sof foyda</div>
            <div className="text-sm text-slate-500">{fromToDate(data.period)}</div>
          </div>
          <div className={`text-3xl font-bold ${(data.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatMoney(data.netProfit || 0)}
          </div>
        </div>
      </div>
    </div>
  )
}

function CashFlowReport({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4">
      <Section title="Pul oqimi hisoboti">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Boshlang\'ich balans</div>
            <div className="font-bold text-slate-900">{formatMoney(data.openingBalance || 0)}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Yakuniy balans</div>
            <div className="font-bold text-slate-900">{formatMoney(data.closingBalance || 0)}</div>
          </div>
        </div>
        <FlowGroup title="Operatsion faoliyat" items={data.operatingActivities} />
        <FlowGroup title="Investitsion faoliyat" items={data.investingActivities} />
        <FlowGroup title="Moliyaviy faoliyat" items={data.financingActivities} />
        <Row label="Sof pul oqimi" value={data.netCashFlow || 0} strong />
      </Section>
    </div>
  )
}

function FlowGroup({ title, items }: { title: string; items?: Array<{ label: string; amount: number }> }) {
  if (!items || items.length === 0) return null
  const total = items.reduce((s, i) => s + i.amount, 0)
  return (
    <div className="mb-3">
      <div className="text-xs font-bold text-slate-500 uppercase mb-1">{title}</div>
      {items.map((it, i) => (
        <Row key={i} label={it.label} value={it.amount} muted />
      ))}
      <Row label={`Jami (${title})`} value={total} strong />
    </div>
  )
}

function SummaryReport({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4">
      <Section title="Umumiy ko\'rsatkichlar">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {data.summary?.map((s, i) => (
            <div key={i} className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs text-slate-500 uppercase font-semibold mb-1">{s.label}</div>
              <div className="text-lg font-bold text-slate-900">
                {s.type === 'money' ? formatMoney(s.value) : new Intl.NumberFormat('uz-UZ').format(s.value)}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function fromToDate(period?: { from: string; to: string }) {
  if (!period) return ''
  return `${period.from} — ${period.to}`
}
