'use client'

import { useState, useEffect } from 'react'
import { api, formatMoney, toast, formatDateTime, formatNumber } from './utils'

export default function ReportsView() {
  const [report, setReport] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(`/api/reports?from=${from}&to=${to}`)
      setReport(res)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading || !report) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  const s = report.summary

  return (
    <div className="space-y-6">
      {/* Header + date range */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">📊 Hisobotlar (to'liq hisob-kitob)</h2>
          <p className="text-slate-500 text-sm">Barcha savdo, kirim, chiqim, ombor va moliyaviy ma'lumotlar</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="erp-input max-w-[150px]" />
          <span className="text-slate-400">→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="erp-input max-w-[150px]" />
          <button onClick={load} className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold">Ko'rsatish</button>
        </div>
      </div>

      {/* ===== SUMMARY ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Jami savdo" value={formatMoney(s.totalSales)} color="emerald" icon="💰" />
        <Stat label="Sof foyda (savdo)" value={formatMoney(s.totalProfit)} color="teal" icon="📈" />
        <Stat label="Xarajatlar (chiqim)" value={formatMoney(s.totalExpenses)} color="red" icon="💸" />
        <Stat label="Sof foyda (yakuniy)" value={formatMoney(s.netProfit)} color={s.netProfit >= 0 ? 'emerald' : 'red'} icon={s.netProfit >= 0 ? '✓' : '⚠'} />
        <Stat label="Tannarx (COGS)" value={formatMoney(s.totalCost)} color="orange" icon="📦" />
        <Stat label="Kirim (sotib olish)" value={formatMoney(s.totalPurchases)} color="cyan" icon="🚚" />
        <Stat label="Ombor qiymati" value={formatMoney(s.inventoryValue)} color="purple" icon="🏭" />
        <Stat label="Buyurtmalar" value={`${s.orderCount} ta`} color="slate" icon="🧾" />
        <Stat label="O'rtacha chek" value={formatMoney(s.avgOrder)} color="slate" icon="📊" />
        <Stat label="Foyda marjasi" value={`${s.profitMargin.toFixed(1)}%`} color="emerald" icon="🎯" />
        <Stat label="Taomlar" value={`${s.productCount} ta`} color="blue" icon="🍽️" />
        <Stat label="Tugagan mahsulot" value={`${s.lowStockCount} ta`} color={s.lowStockCount > 0 ? 'red' : 'slate'} icon="⚠️" />
      </div>

      {/* ===== OFITSIANTLAR va STOLLAR ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">👤 Ofitsiantlar bo'yicha</h3>
          {(!report.byWaiter || report.byWaiter.length === 0) ? (
            <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p>
          ) : (
            <div className="space-y-2">
              {report.byWaiter.map((w: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>{i + 1}</div>
                    <div>
                      <div className="font-medium text-slate-900">{w.name}</div>
                      <div className="text-xs text-slate-500">{w.orders} ta buyurtma</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{formatMoney(w.revenue)}</div>
                    <div className="text-xs text-emerald-600">+{formatMoney(w.profit)} foyda</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">🪑 Stollar bo'yicha</h3>
          {(!report.byTable || report.byTable.length === 0) ? (
            <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scroll">
              {report.byTable.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🪑</span>
                    <div>
                      <div className="font-medium text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.orders} ta buyurtma</div>
                    </div>
                  </div>
                  <div className="font-semibold text-slate-900">{formatMoney(t.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== KATEGORIYALAR va MAHSULOTLAR ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">🏷️ Kategoriyalar bo'yicha</h3>
          {report.byCategory.length === 0 ? <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p> : (
            <div className="space-y-2">
              {report.byCategory.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{formatMoney(c.revenue)}</div>
                    <div className="text-xs text-emerald-600">+{formatMoney(c.profit)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">🍽️ Mahsulotlar bo'yicha</h3>
          {report.byProduct.length === 0 ? <p className="text-center text-slate-400 py-8">Ma'lumot yo'q</p> : (
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scroll">
              {report.byProduct.slice(0, 15).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-xs text-slate-400">{i + 1}</span>
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{p.name}</div>
                      <div className="text-xs text-slate-500">{formatNumber(p.qty)} ta sotilgan</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900 text-sm">{formatMoney(p.revenue)}</div>
                    <div className="text-xs text-emerald-600">+{formatMoney(p.profit)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== KIRIM (PURCHASES) ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">🚚 Kirim (xomashyo sotib olish) — {report.allPurchases.length} ta</h3>
        {report.allPurchases.length === 0 ? <p className="text-center text-slate-400 py-6">Kirim yo'q</p> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Chek #</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Sana</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Yetkazib beruvchi</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Mahsulotlar</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Summa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.allPurchases.slice(0, 30).map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-sm text-slate-900">{p.invoiceNo}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{formatDateTime(p.createdAt)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{p.supplier}</td>
                    <td className="px-3 py-2 text-sm text-slate-500">{p.itemCount} ta pozitsiya</td>
                    <td className="px-3 py-2 text-right font-bold text-cyan-600">{formatMoney(p.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right font-bold text-slate-700">Jami kirim:</td>
                  <td className="px-3 py-2 text-right font-bold text-cyan-700">{formatMoney(s.totalPurchases)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ===== CHIQIM (EXPENSES) ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">💸 Chiqimlar (xarajatlar) — {report.allExpenses.length} ta</h3>
        {report.allExpenses.length === 0 ? <p className="text-center text-slate-400 py-6">Chiqim yo'q</p> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Kategoriya</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Tavsif</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Sana</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Summa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.allExpenses.slice(0, 30).map((e: any) => {
                  const m: Record<string, string> = { rent: '🏠 Ijara', salary: '👷 Maosh', utility: '💡 Kommunal', marketing: '📢 Reklama', equipment: '🔧 Uskuna', other: '📦 Boshqa' }
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm">{m[e.category] || e.category}</td>
                      <td className="px-3 py-2 text-sm text-slate-600">{e.description || '—'}</td>
                      <td className="px-3 py-2 text-sm text-slate-500">{formatDateTime(e.date)}</td>
                      <td className="px-3 py-2 text-right font-bold text-red-500">−{formatMoney(e.amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right font-bold text-slate-700">Jami chiqim:</td>
                  <td className="px-3 py-2 text-right font-bold text-red-600">−{formatMoney(s.totalExpenses)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ===== OMBOR (INVENTORY) ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">🏭 Ombor holati — {report.inventory.length} ta mahsulot (qiymat: {formatMoney(s.inventoryValue)})</h3>
        {report.inventory.length === 0 ? <p className="text-center text-slate-400 py-6">Omborda mahsulot yo'q</p> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Mahsulot</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Qoldiq</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Narx (1 birlik)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Qiymati</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.inventory.map((i: any) => (
                  <tr key={i.id} className={`hover:bg-slate-50 ${i.isLowStock ? 'bg-red-50/50' : ''}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{i.name}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatNumber(i.stock)} {i.unit}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{formatMoney(i.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-purple-600">{formatMoney(i.totalValue)}</td>
                    <td className="px-3 py-2 text-center">
                      {i.isLowStock ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">⚠️ Tugagan</span> : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">✓ Bor</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right font-bold text-slate-700">Ombor umumiy qiymati:</td>
                  <td className="px-3 py-2 text-right font-bold text-purple-700">{formatMoney(s.inventoryValue)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ===== SAVDO TARIXI (TO'LIQ) ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">🧾 Savdo tarixi — {report.recentSales.length} ta</h3>
        {report.recentSales.length === 0 ? <p className="text-center text-slate-400 py-6">Savdo yo'q</p> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Chek #</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Sana</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Stol</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Ofitsiant</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Kassir</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Pozitsiya</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">To'lov</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Summa</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Foyda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.recentSales.slice(0, 50).map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-sm font-semibold text-slate-900">{s.invoiceNo}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{formatDateTime(s.createdAt)}</td>
                    <td className="px-3 py-2 text-sm">{s.tableName ? `🪑 ${s.tableName}` : '—'}</td>
                    <td className="px-3 py-2 text-sm">{s.waiterName ? `👤 ${s.waiterName}` : '—'}</td>
                    <td className="px-3 py-2 text-sm text-slate-400">{s.kassir ? `💳 ${s.kassir}` : '—'}</td>
                    <td className="px-3 py-2 text-center text-sm text-slate-600">{s.itemCount}</td>
                    <td className="px-3 py-2 text-sm">{s.paymentMethod === 'cash' ? '💵 Naqd' : s.paymentMethod === 'card' ? '💳 Karta' : '🔄 O\'tkazma'}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">{formatMoney(s.total)}</td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-emerald-600">+{formatMoney(s.profit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan={7} className="px-3 py-2 text-right font-bold text-slate-700">Jami savdo:</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatMoney(s.totalSales)}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-600">+{formatMoney(s.totalProfit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ===== KUNLIK SAVDO GRAFIGI ===== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">📅 Kunlik savdo grafigi</h3>
        {report.byDay.length === 0 ? <p className="text-center text-slate-400 py-6">Ma'lumot yo'q</p> : (
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scroll">
            {(() => {
              const max = Math.max(...report.byDay.map((d: any) => d.sales), 1)
              return report.byDay.map((d: any) => (
                <div key={d.date} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-slate-500">{new Date(d.date).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })}</div>
                  <div className="flex-1 bg-slate-100 rounded h-7 overflow-hidden">
                    <div className="h-full bg-emerald-500 flex items-center justify-end pr-2" style={{ width: `${(d.sales / max) * 100}%`, minWidth: '60px' }}>
                      <span className="text-xs font-semibold text-white">{formatMoney(d.sales)}</span>
                    </div>
                  </div>
                  <div className="w-24 text-right text-xs text-emerald-600">+{formatMoney(d.profit)}</div>
                </div>
              ))
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500 to-teal-600',
    teal: 'from-teal-500 to-cyan-600',
    blue: 'from-blue-500 to-cyan-600',
    purple: 'from-purple-500 to-pink-600',
    amber: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-orange-600',
    orange: 'from-orange-500 to-yellow-600',
    cyan: 'from-cyan-500 to-blue-600',
    slate: 'from-slate-600 to-slate-700'
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color] || colors.slate} flex items-center justify-center text-xl shadow-md mb-3`}>{icon}</div>
      <div className="text-sm text-slate-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
    </div>
  )
}
