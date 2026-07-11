'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, Modal, useConfirm } from './utils'

type Budget = {
  id: string
  period: string
  year: number
  month: number | null
  category: string
  plannedAmount: number
  actualAmount: number
}

const PERIODS = [
  { value: 'monthly', label: 'Oylik' },
  { value: 'quarterly', label: 'Choraklik' },
  { value: 'yearly', label: 'Yillik' }
]

const CATEGORIES = [
  { value: 'ingredients', label: 'Xomashyo' },
  { value: 'salaries', label: 'Maoshlar' },
  { value: 'rent', label: 'Ijara' },
  { value: 'utilities', label: 'Kommunal' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'equipment', label: 'Uskunalar' },
  { value: 'maintenance', label: 'Ta\'mirlash' },
  { value: 'other', label: 'Boshqa' }
]

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
]

export default function BudgetsView() {
  const [items, setItems] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const { confirm, dialog } = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/budgets')
      setItems(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const del = async (b: Budget) => {
    if (!(await confirm('Byudjetni o\'chirishni tasdiqlaysizmi?'))) return
    try {
      await api(`/api/budgets/${b.id}`, { method: 'DELETE' })
      toast.success('O\'chirildi')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const totalPlanned = items.reduce((s, b) => s + b.plannedAmount, 0)
  const totalActual = items.reduce((s, b) => s + (b.actualAmount || 0), 0)
  const diff = totalPlanned - totalActual

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
          <h2 className="text-2xl font-bold text-slate-900">💼 Byudjetlar</h2>
          <p className="text-slate-500 text-sm">
            Reja: <span className="font-semibold text-slate-700">{formatMoney(totalPlanned)}</span> •
            Fakt: <span className="font-semibold text-slate-700">{formatMoney(totalActual)}</span> •
            Farq: <span className={`font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(diff)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25"
        >
          + Yangi byudjet
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">💼</div>
          Byudjetlar yo'q
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Davr</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Kategoriya</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Reja</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Fakt</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Farq</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(b => {
                  const diff = b.plannedAmount - (b.actualAmount || 0)
                  const cat = CATEGORIES.find(c => c.value === b.category)?.label || b.category
                  const periodLabel = b.period === 'monthly'
                    ? `${MONTHS[(b.month || 1) - 1]} ${b.year}`
                    : b.period === 'quarterly'
                    ? `${b.year} - Chorak ${Math.ceil((b.month || 1) / 3)}`
                    : `${b.year}`
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{periodLabel}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">{cat}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900 font-medium">{formatMoney(b.plannedAmount)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatMoney(b.actualAmount || 0)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {diff >= 0 ? '+' : ''}{formatMoney(diff)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => del(b)} className="text-slate-300 hover:text-red-500 text-lg">×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <BudgetForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />
      )}
      {dialog}
    </div>
  )
}

function BudgetForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [period, setPeriod] = useState('monthly')
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [category, setCategory] = useState('ingredients')
  const [plannedAmount, setPlannedAmount] = useState(0)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!plannedAmount) {
      toast.error('Rejalashtirilgan miqdorni kiriting')
      return
    }
    setSaving(true)
    try {
      await api('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({
          period,
          year,
          month: period === 'yearly' ? null : month,
          category,
          plannedAmount
        })
      })
      toast.success('Byudjet qo\'shildi')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Yangi byudjet">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Davr</label>
            <select className="erp-input" value={period} onChange={e => setPeriod(e.target.value)}>
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Yil</label>
            <input
              type="number"
              className="erp-input"
              value={year}
              onChange={e => setYear(parseInt(e.target.value) || currentYear)}
            />
          </div>
        </div>
        {period !== 'yearly' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Oy</label>
            <select className="erp-input" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Kategoriya</label>
          <select className="erp-input" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Rejalashtirilgan miqdor (UZS)</label>
          <input
            type="number"
            className="erp-input"
            value={plannedAmount || ''}
            onChange={e => setPlannedAmount(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">Bekor</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : '✓ Saqlash'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
