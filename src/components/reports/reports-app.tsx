'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiData, ApiError } from '@/lib/api';
import {
  Loader2, RefreshCw, TrendingUp, TrendingDown, Wallet, Banknote,
  CreditCard, Smartphone, Percent, Package, Users, ChefHat, Flame,
  BarChart3, PieChart, Calendar, AlertCircle, Receipt, ArrowDownCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface Summary {
  period: string;
  from: string;
  to: string;
  payments_count: number;
  total_sales: number;
  cash_sales: number;
  card_sales: number;
  click_sales: number;
  payme_sales: number;
  tips: number;
  discounts: number;
  change_given: number;
  voids: number;
  expenses: number;
  net_revenue: number;
}

interface DayData {
  date: string;
  label: string;
  payments_count: number;
  total_sales: number;
  cash_sales: number;
  card_sales: number;
  click_sales: number;
  payme_sales: number;
}

interface ProductData {
  product_id: string;
  product_name: string;
  station: string;
  times_ordered: number;
  total_quantity: number;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
}

interface CategoryData {
  category_id: string;
  category_name: string;
  station: string;
  orders_count: number;
  total_quantity: number;
  total_revenue: number;
}

interface WaiterData {
  waiter_id: string;
  waiter_name: string;
  orders_count: number;
  payments_count: number;
  total_sales: number;
  total_tips: number;
  avg_order_value: number;
}

interface StationData {
  station: string;
  orders_count: number;
  total_quantity: number;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
}

export function ReportsApp() {
  const [period, setPeriod] = useState<Period>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [byDay, setByDay] = useState<DayData[]>([]);
  const [byProduct, setByProduct] = useState<ProductData[]>([]);
  const [byCategory, setByCategory] = useState<CategoryData[]>([]);
  const [byWaiter, setByWaiter] = useState<WaiterData[]>([]);
  const [byStation, setByStation] = useState<StationData[]>([]);
  const [loading, setLoading] = useState(true);

  const periodParams = (p: Period) => {
    if (p === 'custom') return `period=custom&from=${customFrom}&to=${customTo}`;
    return `period=${p}`;
  };

  const fetchAll = useCallback(async (p: Period) => {
    if (p === 'custom' && !customFrom) return;
    setLoading(true);
    try {
      const params = periodParams(p);
      const [s, d, prod, cat, w, st] = await Promise.all([
        apiData<Summary>(`/api/reports/summary?${params}`),
        apiData<DayData[]>(`/api/reports/by-day?${params}`).catch(() => []),
        apiData<ProductData[]>(`/api/reports/by-product?${params}&limit=10`).catch(() => []),
        apiData<CategoryData[]>(`/api/reports/by-category?${params}`).catch(() => []),
        apiData<WaiterData[]>(`/api/reports/by-waiter?${params}`).catch(() => []),
        apiData<StationData[]>(`/api/reports/by-station?${params}`).catch(() => []),
      ]);
      setSummary(s);
      setByDay(d ?? []);
      setByProduct(prod ?? []);
      setByCategory(cat ?? []);
      setByWaiter(w ?? []);
      setByStation(st ?? []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Hisobot yuklanmadi');
    } finally {
      setLoading(false);
    }
  }, [customFrom, customTo]);

  useEffect(() => {
    fetchAll(period);
  }, [period, fetchAll]);

  const periods: Array<{ id: Period; label: string }> = [
    { id: 'today', label: 'Bugun' },
    { id: 'yesterday', label: 'Kecha' },
    { id: 'week', label: 'Hafta' },
    { id: 'month', label: 'Oy' },
    { id: 'custom', label: 'Sana' },
  ];

  const formatMoney = (n: number) => Number(n).toLocaleString('uz-UZ');

  if (loading && !summary) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-24">
      {/* Period selector */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {periods.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              period === p.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-1">
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9 w-36 text-xs" />
            <span className="text-slate-400 text-xs">—</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-9 w-36 text-xs" />
            <Button size="sm" onClick={() => fetchAll('custom')} disabled={!customFrom} className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700">
              Ko'rish
            </Button>
          </div>
        )}
      </div>

      {summary && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <KPICard icon={TrendingUp} label="Jami savdo" value={formatMoney(summary.total_sales)} suffix="so'm" color="emerald" />
            <KPICard icon={Wallet} label="Sof tushum" value={formatMoney(summary.net_revenue)} suffix="so'm" color="blue" />
            <KPICard icon={Receipt} label="To'lovlar" value={String(summary.payments_count)} suffix="ta" color="slate" />
            <KPICard icon={AlertCircle} label="Bekor" value={String(summary.voids)} suffix="ta" color="red" />
          </div>

          {/* Payment breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <KPICard icon={Banknote} label="Naqd" value={formatMoney(summary.cash_sales)} suffix="so'm" color="emerald" small />
            <KPICard icon={CreditCard} label="Karta" value={formatMoney(summary.card_sales)} suffix="so'm" color="blue" small />
            <KPICard icon={Smartphone} label="Click" value={formatMoney(summary.click_sales)} suffix="so'm" color="sky" small />
            <KPICard icon={Smartphone} label="Payme" value={formatMoney(summary.payme_sales)} suffix="so'm" color="violet" small />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
            <KPICard icon={Percent} label="Chegirma" value={formatMoney(summary.discounts)} suffix="so'm" color="amber" small />
            <KPICard icon={TrendingUp} label="Choy puli" value={formatMoney(summary.tips)} suffix="so'm" color="emerald" small />
            <KPICard icon={ArrowDownCircle} label="Xarajat" value={formatMoney(summary.expenses)} suffix="so'm" color="red" small />
            <KPICard icon={Wallet} label="Qaytim" value={formatMoney(summary.change_given)} suffix="so'm" color="slate" small />
          </div>

          {/* Daily sales chart */}
          {byDay.length > 0 && (
            <Section title="Kunlik savdo" icon={BarChart3}>
              <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
                {byDay.map((d, i) => {
                  const max = Math.max(...byDay.map(x => x.total_sales), 1);
                  const heightPct = (d.total_sales / max) * 100;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 min-w-[40px]">
                      <div className="text-[9px] text-slate-500 font-medium">{formatMoney(d.total_sales).replace(/000$/, 'k')}</div>
                      <div
                        className="w-8 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all hover:from-emerald-700 hover:to-emerald-500"
                        style={{ height: `${Math.max(heightPct, 2)}%` }}
                        title={`${d.label}: ${formatMoney(d.total_sales)} so'm`}
                      />
                      <div className="text-[9px] text-slate-400">{d.label}</div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Two columns: Top products + Station breakdown */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {/* Top products */}
            <Section title="Eng ko'p sotilgan" icon={Package}>
              {byProduct.length === 0 ? (
                <EmptyState text="Mahsulot yo'q" />
              ) : (
                <div className="space-y-1.5">
                  {byProduct.map((p, i) => {
                    const maxQty = byProduct[0]?.total_quantity ?? 1;
                    const pct = (p.total_quantity / maxQty) * 100;
                    return (
                      <div key={p.product_id} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-bold w-5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-900 truncate">{p.product_name}</span>
                            <span className="text-xs text-slate-500 ml-2">×{p.total_quantity}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{formatMoney(p.total_revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Station breakdown */}
            <Section title="Bo'limlar" icon={ChefHat}>
              {byStation.length === 0 ? (
                <EmptyState text="Ma'lumot yo'q" />
              ) : (
                <div className="space-y-2">
                  {byStation.map(s => {
                    const stationConfig: Record<string, { label: string; icon: typeof ChefHat; color: string }> = {
                      kitchen: { label: 'Oshxona', icon: ChefHat, color: 'text-orange-600 bg-orange-50' },
                      kebab: { label: 'Kabob', icon: Flame, color: 'text-red-600 bg-red-50' },
                      bar: { label: 'Bar', icon: Wallet, color: 'text-purple-600 bg-purple-50' },
                      other: { label: 'Boshqa', icon: Package, color: 'text-slate-600 bg-slate-50' },
                    };
                    const cfg = stationConfig[s.station] ?? stationConfig.other;
                    const Icon = cfg.icon;
                    return (
                      <div key={s.station} className="flex items-center gap-3 p-2 rounded-lg border border-slate-100">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 text-sm">{cfg.label}</div>
                          <div className="text-xs text-slate-500">{s.orders_count} buyurtma · ×{s.total_quantity}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-900 text-sm">{formatMoney(s.total_revenue)}</div>
                          <div className="text-[10px] text-emerald-600">+{formatMoney(s.gross_profit)} foyda</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>

          {/* Category breakdown */}
          {byCategory.length > 0 && (
            <Section title="Kategoriya bo'yicha" icon={PieChart}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {byCategory.map(c => (
                  <div key={c.category_id} className="p-2 rounded-lg border border-slate-100">
                    <div className="font-medium text-slate-900 text-sm">{c.category_name}</div>
                    <div className="text-xs text-slate-500">{c.total_quantity} dona · {c.orders_count} buyrutma</div>
                    <div className="font-bold text-emerald-700 text-sm mt-1">{formatMoney(c.total_revenue)} so'm</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Waiter performance */}
          {byWaiter.length > 0 && (
            <Section title="Ofitsiantlar bo'yicha" icon={Users}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                      <th className="py-2">Ofitsiant</th>
                      <th className="text-center">Buyurtma</th>
                      <th className="text-center">O'rtacha</th>
                      <th className="text-right">Savdo</th>
                      <th className="text-right">Choy puli</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byWaiter.map(w => (
                      <tr key={w.waiter_id} className="border-b border-slate-50">
                        <td className="py-2 font-medium text-slate-900">{w.waiter_name}</td>
                        <td className="text-center text-slate-600">{w.orders_count}</td>
                        <td className="text-center text-slate-600">{formatMoney(w.avg_order_value)}</td>
                        <td className="text-right font-bold text-slate-900">{formatMoney(w.total_sales)}</td>
                        <td className="text-right text-emerald-600">{formatMoney(w.total_tips)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function KPICard({
  icon: Icon, label, value, suffix, color, small,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  suffix: string;
  color: 'emerald' | 'blue' | 'red' | 'amber' | 'slate' | 'sky' | 'violet';
  small?: boolean;
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700' },
    red: { bg: 'bg-red-50', text: 'text-red-700' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-700' },
    sky: { bg: 'bg-sky-50', text: 'text-sky-700' },
    violet: { bg: 'bg-violet-50', text: 'text-violet-700' },
  };
  const c = colors[color] ?? colors.slate;
  return (
    <div className={`${c.bg} rounded-xl p-3 border border-slate-100`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 ${c.text}`} />
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className={`${small ? 'text-base' : 'text-xl'} font-bold ${c.text}`}>
        {value}
        <span className="text-[10px] ml-1 font-normal">{suffix}</span>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof BarChart3; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-slate-600" />
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-6 text-slate-400 text-sm">{text}</div>;
}
