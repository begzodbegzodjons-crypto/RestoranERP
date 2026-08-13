'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiData, ApiError } from '@/lib/api';
import { Loader2, Plus, Users, Package, Table as TableIcon, RefreshCw, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Tab = 'staff' | 'menu' | 'tables';

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>('staff');
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [s, p, t] = await Promise.all([
        apiData<any[]>('/api/users').catch(() => []),
        apiData<any[]>('/api/products').catch(() => []),
        apiData<any[]>('/api/tables').catch(() => []),
      ]);
      setStaff(s ?? []);
      setProducts(p ?? []);
      setTables(t ?? []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  const tabs = [
    { id: 'staff' as const, label: 'Xodimlar', icon: Users, count: staff.length },
    { id: 'menu' as const, label: 'Menyu', icon: Package, count: products.length },
    { id: 'tables' as const, label: 'Stollar', icon: TableIcon, count: tables.length },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-24">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
              <Icon className="h-4 w-4" /> {t.label} ({t.count})
            </button>
          );
        })}
      </div>

      {tab === 'staff' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">Xodimlar</h2>
            <Button size="sm" onClick={() => setShowAddStaff(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> Yangi xodim
            </Button>
          </div>
          <div className="space-y-2">
            {staff.map(s => (
              <div key={s.id} className="bg-white rounded-lg border border-slate-200 p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700">
                  {s.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.phone} · {s.role_display_name || s.role_name}</div>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {s.is_active ? 'Faol' : 'Nofaol'}
                </span>
              </div>
            ))}
          </div>
          {showAddStaff && <AddStaffModal onClose={() => setShowAddStaff(false)} onSaved={() => { setShowAddStaff(false); fetchAll(); }} />}
        </div>
      )}

      {tab === 'menu' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">Menyu</h2>
            <Button size="sm" onClick={() => setShowAddProduct(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> Yangi mahsulot
            </Button>
          </div>
          <div className="space-y-2">
            {products.map(p => (
              <div key={p.id} className="bg-white rounded-lg border border-slate-200 p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.type === 'kitchen' ? 'bg-orange-100' : p.type === 'kebab' ? 'bg-red-100' : 'bg-purple-100'}`}>
                  <Package className={`h-5 w-5 ${p.type === 'kitchen' ? 'text-orange-600' : p.type === 'kebab' ? 'text-red-600' : 'text-purple-600'}`} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900 text-sm">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.category_name || 'Kategoriyasiz'} · {p.type}</div>
                </div>
                <div className="font-bold text-emerald-700">{Number(p.current_price ?? 0).toLocaleString('uz-UZ')} so'm</div>
              </div>
            ))}
          </div>
          {showAddProduct && <AddProductModal onClose={() => setShowAddProduct(false)} onSaved={() => { setShowAddProduct(false); fetchAll(); }} />}
        </div>
      )}

      {tab === 'tables' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">Stollar</h2>
            <Button size="sm" variant="ghost" onClick={fetchAll}><RefreshCw className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {tables.map(t => (
              <div key={t.id} className={`rounded-xl border-2 p-3 ${t.status === 'free' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="font-bold text-slate-900">{t.name}</div>
                <div className="text-xs text-slate-500">{t.capacity} kishi</div>
                <span className={`text-[10px] font-bold uppercase ${t.status === 'free' ? 'text-emerald-700' : 'text-amber-700'}`}>{t.status === 'free' ? 'BO\'SH' : 'BAND'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AddStaffModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('waiter');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiData('/api/users', { method: 'POST', body: JSON.stringify({ name, phone, pin, roleName: role }) });
      toast.success('Xodim qo\'shildi');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xato');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">Yangi xodim</h2>
        <div className="space-y-3">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ism familiya" className="h-10" />
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998901234567" className="h-10" />
          <Input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN (4-8 raqam)" className="h-10" />
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm">
            <option value="waiter">Ofitsiant</option>
            <option value="cashier">Kassir</option>
            <option value="kitchen">Oshxona</option>
            <option value="kebab">Kabob</option>
            <option value="warehouse">Ombor</option>
          </select>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10">Bekor</Button>
          <Button onClick={handleSave} disabled={saving || !name || !phone || !pin} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Saqlash'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddProductModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('kitchen');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiData('/api/products', { method: 'POST', body: JSON.stringify({ name, price: Number(price), type }) });
      toast.success('Mahsulot qo\'shildi');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Xato');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">Yangi mahsulot</h2>
        <div className="space-y-3">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Mahsulot nomi" className="h-10" />
          <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="Narx (so'm)" className="h-10" />
          <select value={type} onChange={e => setType(e.target.value)} className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm">
            <option value="kitchen">Oshxona</option>
            <option value="kebab">Kabob</option>
            <option value="bar">Bar</option>
          </select>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10">Bekor</Button>
          <Button onClick={handleSave} disabled={saving || !name || !price} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Saqlash'}
          </Button>
        </div>
      </div>
    </div>
  );
}
