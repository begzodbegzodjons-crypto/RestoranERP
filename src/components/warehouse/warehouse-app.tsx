'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiData, ApiError } from '@/lib/api';
import {
  Loader2, RefreshCw, Plus, Package, TrendingUp, TrendingDown, AlertTriangle,
  ArrowUp, ArrowDown, Trash2, Edit, X, Wallet, Truck, History, Box
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Tab = 'ingredients' | 'transactions' | 'low-stock' | 'suppliers' | 'expenses';

export function WarehouseApp() {
  const [tab, setTab] = useState<Tab>('ingredients');

  const tabs: Array<{ id: Tab; label: string; icon: typeof Box }> = [
    { id: 'ingredients', label: 'Mahsulotlar', icon: Box },
    { id: 'transactions', label: 'Harakatlar', icon: History },
    { id: 'low-stock', label: 'Kam qoldiq', icon: AlertTriangle },
    { id: 'suppliers', label: 'Ta\'minotchi', icon: Truck },
    { id: 'expenses', label: 'Xarajat', icon: Wallet },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-24">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'ingredients' && <IngredientsTab />}
      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'low-stock' && <LowStockTab />}
      {tab === 'suppliers' && <SuppliersTab />}
      {tab === 'expenses' && <ExpensesTab />}
    </div>
  );
}

function IngredientsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<any | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const data = await apiData<any[]>('/api/inventory');
      setItems(data ?? []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Mahsulotlar yuklanmadi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 10000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-slate-900">Mahsulotlar ({items.length})</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchItems} className="text-slate-600">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => { setEditingItem(null); setShowModal(true); }} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1" /> Yangi
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map(item => {
          const stock = Number(item.stock);
          const minStock = Number(item.min_stock);
          const isLow = stock < minStock;
          const isCritical = stock < minStock / 2;
          return (
            <div key={item.id} className={`bg-white rounded-xl border-2 p-3 ${isCritical ? 'border-red-300' : isLow ? 'border-amber-300' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isCritical ? 'bg-red-100' : isLow ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                    <Package className={`h-5 w-5 ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'}`} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-500">
                      {item.sku && <span>{item.sku} · </span>}
                      {item.unit} · {Number(item.cost).toLocaleString('uz-UZ')} so&apos;m/{item.unit}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                    {stock.toLocaleString('uz-UZ')}
                  </div>
                  <div className="text-[10px] text-slate-400">{item.unit} qoldiq</div>
                </div>
              </div>

              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all ${isCritical ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, minStock > 0 ? (stock / minStock) * 100 : 100)}%` }}
                />
              </div>

              {isLow && (
                <div className={`text-[10px] mb-2 ${isCritical ? 'text-red-600' : 'text-amber-600'} flex items-center gap-1`}>
                  <AlertTriangle className="h-3 w-3" />
                  {isCritical ? 'KRITIK!' : 'Kam qoldiq'} — min: {minStock} {item.unit}
                </div>
              )}

              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setAdjustingItem(item)} className="flex-1 h-8 text-xs">
                  <ArrowUp className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Kirim
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAdjustingItem(item)} className="flex-1 h-8 text-xs">
                  <ArrowDown className="h-3.5 w-3.5 mr-1 text-red-600" />
                  Chiqim
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditingItem(item); setShowModal(true); }} className="h-8 px-2 text-xs">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  if (confirm('O\'chirishni tasdiqlaysizmi?')) {
                    apiData(`/api/inventory/${item.id}`, { method: 'DELETE' })
                      .then(() => { toast.success('O\'chirildi'); fetchItems(); })
                      .catch(err => toast.error(err instanceof ApiError ? err.message : 'Xato'));
                  }
                }} className="h-8 px-2 text-xs text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <IngredientModal item={editingItem} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchItems(); }} />
      )}
      {adjustingItem && (
        <AdjustModal item={adjustingItem} onClose={() => setAdjustingItem(null)} onSaved={() => { setAdjustingItem(null); fetchItems(); }} />
      )}
    </div>
  );
}

function IngredientModal({ item, onClose, onSaved }: { item: any | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [sku, setSku] = useState(item?.sku ?? '');
  const [unit, setUnit] = useState(item?.unit ?? 'kg');
  const [stock, setStock] = useState(item ? String(item.stock) : '0');
  const [minStock, setMinStock] = useState(item ? String(item.min_stock) : '0');
  const [cost, setCost] = useState(item ? String(item.cost) : '0');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { name, sku: sku || null, unit, stock: Number(stock) || 0, minStock: Number(minStock) || 0, cost: Number(cost) || 0 };
      if (item) {
        await apiData(`/api/inventory/${item.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast.success('Yangilandi');
      } else {
        await apiData('/api/inventory', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Yaratildi');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Saqlanmadi');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{item ? 'Tahrirlash' : 'Yangi mahsulot'}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Nomi</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Guruch" className="h-10" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">SKU</label>
              <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="RICE-001" className="h-10" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Birlik</label>
              <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm">
                <option value="kg">kg</option>
                <option value="l">litr</option>
                <option value="piece">dona</option>
                <option value="pack">paket</option>
              </select>
            </div>
          </div>
          {!item && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Boshlang&apos;ich qoldiq</label>
              <Input type="number" value={stock} onChange={e => setStock(e.target.value)} className="h-10" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Min qoldiq</label>
              <Input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tannarx (so&apos;m)</label>
              <Input type="number" value={cost} onChange={e => setCost(e.target.value)} className="h-10" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10">Bekor</Button>
          <Button onClick={handleSave} disabled={saving || !name} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Saqlash'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdjustModal({ item, onClose, onSaved }: { item: any; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'in' | 'out' | 'waste'>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [unitCost, setUnitCost] = useState(String(item.cost));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await apiData<{ newStock: number; lowStockWarning: boolean; criticalWarning: boolean }>(`/api/inventory/${item.id}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ type, quantity: Number(quantity), reason, unitCost: type === 'in' ? Number(unitCost) : undefined }),
      });
      toast.success(`${type === 'in' ? 'Kirim' : type === 'out' ? 'Chiqim' : 'Isrof'} — yangi qoldiq: ${result.newStock}`);
      if (result.criticalWarning) {
        toast.error('DIQQAT! Qoldiq kritik darajada kam!', { description: `${item.name}: ${result.newStock} ${item.unit}` });
      } else if (result.lowStockWarning) {
        toast.warning('Ogohlantirish: qoldiq minimumdan past!', { description: `${item.name}: ${result.newStock} ${item.unit}` });
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Amalga oshmadi');
    } finally { setSaving(false); }
  };

  const types = [
    { id: 'in' as const, label: 'Kirim', icon: TrendingUp, color: 'emerald' },
    { id: 'out' as const, label: 'Chiqim', icon: TrendingDown, color: 'red' },
    { id: 'waste' as const, label: 'Isrof', icon: Trash2, color: 'amber' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{item.name}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 mb-3 text-center">
          <div className="text-xs text-slate-500">Joriy qoldiq</div>
          <div className="text-2xl font-bold text-slate-900">{Number(item.stock).toLocaleString('uz-UZ')} {item.unit}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {types.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg border-2 transition-all ${
                  type === t.id
                    ? t.color === 'emerald' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : t.color === 'red' ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Miqdor ({item.unit})</label>
            <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" className="h-10 text-lg" />
          </div>
          {type === 'in' && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Tannarx (so&apos;m/{item.unit})</label>
              <Input type="number" value={unitCost} onChange={e => setUnitCost(e.target.value)} className="h-10" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Sabab</label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Sababni kiriting..." className="h-10" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10">Bekor</Button>
          <Button onClick={handleSave} disabled={saving || !quantity || !reason} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tasdiqlash'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TransactionsTab() {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await apiData<any[]>('/api/inventory/transactions');
      setTxns(data ?? []);
    } catch { setTxns([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  const typeConfig: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
    in: { label: 'KIRIM', color: 'text-emerald-600 bg-emerald-50', icon: TrendingUp },
    out: { label: 'CHIQIM', color: 'text-red-600 bg-red-50', icon: TrendingDown },
    adjust: { label: 'TAHRIR', color: 'text-blue-600 bg-blue-50', icon: Edit },
    waste: { label: 'ISROF', color: 'text-amber-600 bg-amber-50', icon: Trash2 },
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-3">Harakatlar tarixi ({txns.length})</h2>
      {txns.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <History className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          Harakat yo&apos;q
        </div>
      ) : (
        <div className="space-y-2">
          {txns.map(t => {
            const cfg = typeConfig[t.type] ?? typeConfig.adjust;
            const Icon = cfg.icon;
            const qty = Number(t.quantity);
            const isPositive = qty > 0;
            return (
              <div key={t.id} className="bg-white rounded-lg border border-slate-200 p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-900">{t.ingredient_name}</div>
                  <div className="text-xs text-slate-500">{cfg.label} · {t.reason}</div>
                  <div className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleString('uz-UZ')} · {t.user_name ?? '—'}</div>
                </div>
                <div className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{qty.toLocaleString('uz-UZ')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LowStockTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await apiData<any[]>('/api/inventory/low-stock');
      setAlerts(data ?? []);
    } catch { setAlerts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-3">Kam qoldiq ogohlantirishlari ({alerts.length})</h2>
      {alerts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
          <div className="text-slate-600 font-medium">Hammasi joyida!</div>
          <div className="text-sm text-slate-400">Kam qoldiqli mahsulot yo&apos;q</div>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => {
            const isCritical = a.alert_level === 'critical' || a.alert_level === 'out';
            return (
              <div key={a.id} className={`bg-white rounded-lg border-l-4 p-3 ${isCritical ? 'border-red-500' : 'border-amber-500'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{a.name}</div>
                    <div className="text-xs text-slate-500">Qoldiq: {Number(a.stock).toLocaleString('uz-UZ')} / Min: {Number(a.min_stock).toLocaleString('uz-UZ')} {a.unit}</div>
                  </div>
                  <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${
                    a.alert_level === 'out' ? 'bg-red-600 text-white' : a.alert_level === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {a.alert_level === 'out' ? 'TUGADI' : a.alert_level === 'critical' ? 'KRITIK' : 'KAM'}
                  </span>
                </div>
                {a.supplier_name && <div className="text-xs text-slate-400 mt-1">Ta&apos;minotchi: {a.supplier_name}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await apiData<any[]>('/api/inventory/suppliers');
      setSuppliers(data ?? []);
    } catch { setSuppliers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-slate-900">Ta&apos;minotchilar ({suppliers.length})</h2>
        <Button size="sm" onClick={() => setShowModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" /> Yangi
        </Button>
      </div>
      <div className="space-y-2">
        {suppliers.map(s => (
          <div key={s.id} className="bg-white rounded-lg border border-slate-200 p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-900">{s.name}</div>
              <div className="text-xs text-slate-500">{s.phone} · {s.address}</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold ${Number(s.balance) < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                {Number(s.balance).toLocaleString('uz-UZ')} so&apos;m
              </div>
              <div className="text-[10px] text-slate-400">{Number(s.balance) < 0 ? 'qarz' : 'balans'}</div>
            </div>
          </div>
        ))}
      </div>
      {showModal && <SupplierModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchData(); }} />}
    </div>
  );
}

function SupplierModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiData('/api/inventory/suppliers', { method: 'POST', body: JSON.stringify({ name, phone, address }) });
      toast.success('Ta\'minotchi qo\'shildi');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xato');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Yangi ta&apos;minotchi</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nomi" className="h-10" />
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefon" className="h-10" />
          <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Manzil" className="h-10" />
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10">Bekor</Button>
          <Button onClick={handleSave} disabled={saving || !name} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Saqlash'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExpensesTab() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await apiData<any[]>('/api/inventory/expenses');
      setExpenses(data ?? []);
    } catch { setExpenses([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const categories: Record<string, { label: string; color: string }> = {
    rent: { label: 'Ijara', color: 'bg-purple-100 text-purple-700' },
    salary: { label: 'Maosh', color: 'bg-blue-100 text-blue-700' },
    utility: { label: 'Kommunal', color: 'bg-amber-100 text-amber-700' },
    transport: { label: 'Transport', color: 'bg-cyan-100 text-cyan-700' },
    other: { label: 'Boshqa', color: 'bg-slate-100 text-slate-700' },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Xarajatlar</h2>
          <p className="text-xs text-slate-500">Jami: {total.toLocaleString('uz-UZ')} so&apos;m</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" /> Yangi
        </Button>
      </div>
      <div className="space-y-2">
        {expenses.map(e => {
          const cfg = categories[e.category] ?? categories.other;
          return (
            <div key={e.id} className="bg-white rounded-lg border border-slate-200 p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.color}`}>
                <Wallet className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-900 text-sm">{cfg.label}</div>
                <div className="text-xs text-slate-500">{e.description ?? '—'} · {new Date(e.expense_date).toLocaleDateString('uz-UZ')}</div>
              </div>
              <div className="font-bold text-red-600">-{Number(e.amount).toLocaleString('uz-UZ')}</div>
            </div>
          );
        })}
      </div>
      {showModal && <ExpenseModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchData(); }} />}
    </div>
  );
}

function ExpenseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState('rent');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiData('/api/inventory/expenses', { method: 'POST', body: JSON.stringify({ category, amount: Number(amount), description }) });
      toast.success('Xarajat qo\'shildi');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xato');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Yangi xarajat</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Kategoriya</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm">
              <option value="rent">Ijara</option>
              <option value="salary">Maosh</option>
              <option value="utility">Kommunal</option>
              <option value="transport">Transport</option>
              <option value="other">Boshqa</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Summa (so&apos;m)</label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="h-10 text-lg" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tavsif</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="..." className="h-10" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10">Bekor</Button>
          <Button onClick={handleSave} disabled={saving || !amount} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Saqlash'}
          </Button>
        </div>
      </div>
    </div>
  );
}
