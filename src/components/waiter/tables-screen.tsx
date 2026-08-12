'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiData, ApiError } from '@/lib/api';
import type { Table } from '@/lib/types';
import { Loader2, Users, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface TablesScreenProps {
  onSelectTable: (tableId: string, orderId?: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; bgClass: string; borderClass: string; textClass: string; badgeClass: string }> = {
  free: { label: "BO'SH", bgClass: 'bg-emerald-50 hover:bg-emerald-100', borderClass: 'border-emerald-200', textClass: 'text-emerald-700', badgeClass: 'bg-emerald-600 text-white' },
  occupied: { label: 'BAND', bgClass: 'bg-amber-50 hover:bg-amber-100', borderClass: 'border-amber-300', textClass: 'text-amber-700', badgeClass: 'bg-amber-500 text-white' },
  reserved: { label: 'REZERV', bgClass: 'bg-violet-50 hover:bg-violet-100', borderClass: 'border-violet-200', textClass: 'text-violet-700', badgeClass: 'bg-violet-600 text-white' },
  cleaning: { label: 'TOZALANMOQDA', bgClass: 'bg-slate-100 hover:bg-slate-200', borderClass: 'border-slate-300', textClass: 'text-slate-600', badgeClass: 'bg-slate-500 text-white' },
};

export function TablesScreen({ onSelectTable }: TablesScreenProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTables = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiData<Table[]>('/api/tables');
      setTables(Array.isArray(res) ? res : []);
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof ApiError ? err.message : 'Stollarni yuklab bo\'lmadi');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(() => fetchTables(true), 10000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  // Group by section
  const sections: Record<string, Table[]> = {};
  for (const t of tables) {
    const sec = t.section ?? 'Boshqa';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(t);
  }

  const stats = {
    free: tables.filter(t => t.status === 'free').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
    cleaning: tables.filter(t => t.status === 'cleaning').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-24">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-emerald-700">{stats.free}</div>
          <div className="text-[10px] uppercase tracking-wide text-emerald-600 font-medium">Bo&apos;sh</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-amber-700">{stats.occupied}</div>
          <div className="text-[10px] uppercase tracking-wide text-amber-600 font-medium">Band</div>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-violet-700">{stats.reserved}</div>
          <div className="text-[10px] uppercase tracking-wide text-violet-600 font-medium">Rezerv</div>
        </div>
        <div className="bg-slate-100 border border-slate-300 rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-slate-700">{stats.cleaning}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-600 font-medium">Tozalan.</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-slate-900">Stollar</h2>
        <Button variant="ghost" size="sm" onClick={() => fetchTables()} disabled={refreshing} className="text-slate-600">
          <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Yangilash
        </Button>
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Stollar topilmadi. Admin panelida stollarni qo&apos;shing.
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(sections).map(([section, sectionTables]) => (
            <div key={section}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 px-1">{section}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {sectionTables.map(t => {
                  const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.free;
                  const total = t.current_order_total != null ? Number(t.current_order_total) : null;
                  return (
                    <button
                      key={t.id}
                      onClick={() => onSelectTable(t.id, t.current_order_id ?? undefined)}
                      className={`relative ${cfg.bgClass} ${cfg.borderClass} border-2 rounded-xl p-3 text-left transition-all active:scale-95 min-h-[110px] flex flex-col`}
                    >
                      <div className={`absolute top-2 right-2 ${cfg.badgeClass} text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded`}>
                        {cfg.label}
                      </div>
                      <div className="font-bold text-slate-900 text-base leading-tight mt-3">{t.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {t.capacity} kishi
                      </div>
                      {t.status === 'occupied' && total != null && (
                        <div className="mt-auto pt-2">
                          <div className="text-xs text-slate-500">{t.current_order_items ?? 0} ta buyurtma</div>
                          <div className={`text-sm font-bold ${cfg.textClass}`}>{total.toLocaleString('uz-UZ')} so&apos;m</div>
                          {t.waiter_name && (
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">{t.waiter_name}</div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
