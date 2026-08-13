'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiData, ApiError } from '@/lib/api';
import type { Printer } from '@/lib/types';
import {
  Loader2, RefreshCw, Plus, Printer as PrinterIcon, Edit, Trash2, TestTube,
  Wifi, Usb, CheckCircle2, XCircle, AlertCircle, Power, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface PrintJob {
  id: string;
  status: 'pending' | 'printing' | 'printed' | 'failed';
  attempts: number;
  type: string;
  queued_at: string;
  last_error: string | null;
  printer_name: string;
}

export function PrintersAdmin() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchPrinters = useCallback(async () => {
    try {
      const data = await apiData<Printer[]>('/api/printers');
      setPrinters(data ?? []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Printerlar yuklanmadi');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await apiData<PrintJob[]>('/api/printers/print-jobs/pending');
      setJobs(data ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchPrinters();
    fetchJobs();
    const interval = setInterval(() => {
      fetchPrinters();
      fetchJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchPrinters, fetchJobs]);

  const handleTestPrint = async (printerId: string) => {
    try {
      const result = await apiData<{ jobId: string; message: string; printer: string }>(`/api/printers/${printerId}/test`, {
        method: 'POST',
      });
      toast.success(`Test print navbatga qo'shildi`, { description: `Printer: ${result.printer}` });
      fetchJobs();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Test print amalga oshmadi');
    }
  };

  const handleToggleEnabled = async (printer: Printer) => {
    try {
      await apiData(`/api/printers/${printer.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !printer.enabled }),
      });
      toast.success(`${printer.name} ${printer.enabled ? 'o\'chirildi' : 'yoqildi'}`);
      fetchPrinters();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Yangilanmadi');
    }
  };

  const handleDelete = async (printerId: string) => {
    if (!confirm('Bu printerni o\'chirishni tasdiqlaysizmi?')) return;
    try {
      await apiData(`/api/printers/${printerId}`, { method: 'DELETE' });
      toast.success('Printer o\'chirildi');
      fetchPrinters();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'O\'chirilmadi');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Printerlar ({printers.length})</h2>
          <p className="text-xs text-slate-500">4 ta printer: Kitchen, Kebab, Cashier, Custom</p>
        </div>
        <Button
          onClick={() => { setEditingPrinter(null); setShowModal(true); }}
          className="bg-emerald-600 hover:bg-emerald-700"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Yangi printer
        </Button>
      </div>

      {/* Printers list */}
      <div className="space-y-3 mb-6">
        {printers.map(p => (
          <PrinterCard
            key={p.id}
            printer={p}
            onTest={() => handleTestPrint(p.id)}
            onEdit={() => { setEditingPrinter(p); setShowModal(true); }}
            onToggle={() => handleToggleEnabled(p)}
            onDelete={() => handleDelete(p.id)}
          />
        ))}
      </div>

      {/* Print jobs queue */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 text-sm">Print navbati ({jobs.length})</h3>
          <Button variant="ghost" size="sm" onClick={fetchJobs} className="text-slate-600">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        {jobs.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-slate-500">
            Navbatda print job yo'q
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {jobs.slice(0, 10).map(j => (
              <li key={j.id} className="px-3 py-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">{j.printer_name}</div>
                  <div className="text-xs text-slate-500">
                    {j.type} · {new Date(j.queued_at).toLocaleTimeString('uz-UZ')}
                  </div>
                  {j.last_error && (
                    <div className="text-xs text-red-500 mt-0.5">{j.last_error}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={j.status} />
                  <span className="text-xs text-slate-400">{j.attempts} urinish</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Printer edit/create modal */}
      {showModal && (
        <PrinterModal
          printer={editingPrinter}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchPrinters(); }}
        />
      )}
    </div>
  );
}

function PrinterCard({
  printer, onTest, onEdit, onToggle, onDelete,
}: {
  printer: Printer;
  onTest: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const stationColors: Record<string, string> = {
    kitchen: 'bg-orange-100 text-orange-700',
    kebab: 'bg-red-100 text-red-700',
    cashier: 'bg-blue-100 text-blue-700',
    bar: 'bg-purple-100 text-purple-700',
    other: 'bg-slate-100 text-slate-700',
  };
  const stationLabels: Record<string, string> = {
    kitchen: 'OSHXONA',
    kebab: 'KABOB',
    cashier: 'KASSIR',
    bar: 'BAR',
    other: 'BOSHQA',
  };

  return (
    <div className={`bg-white rounded-xl border-2 p-4 ${printer.enabled ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stationColors[printer.station] ?? stationColors.other}`}>
            <PrinterIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900">{printer.name}</div>
            <div className="text-xs text-slate-500">
              {stationLabels[printer.station] ?? printer.station} · #{printer.id.substring(0, 12)}
            </div>
          </div>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${printer.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
          {printer.enabled ? 'Yoqilgan' : 'O\'chirilgan'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-3">
        <div className="flex items-center gap-1">
          {printer.connection_type === 'lan' ? <Wifi className="h-3.5 w-3.5" /> : <Usb className="h-3.5 w-3.5" />}
          <span>{printer.connection_type === 'lan' ? `${printer.ip_address}:${printer.port}` : printer.usb_name}</span>
        </div>
        <div>Paper: {printer.paper_width}mm</div>
        <div>Retry: {printer.retry_count} marta</div>
        <div>Timeout: {printer.timeout_ms}ms</div>
      </div>

      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" onClick={onTest} className="flex-1 h-8 text-xs">
          <TestTube className="h-3.5 w-3.5 mr-1" />
          Test
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 h-8 text-xs">
          <Edit className="h-3.5 w-3.5 mr-1" />
          Tahrir
        </Button>
        <Button size="sm" variant="outline" onClick={onToggle} className="h-8 px-2 text-xs">
          <Power className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete} className="h-8 px-2 text-xs text-red-600 hover:bg-red-50">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; class: string; icon: typeof CheckCircle2 }> = {
    pending: { label: 'PENDING', class: 'bg-amber-100 text-amber-700', icon: AlertCircle },
    printing: { label: 'PRINTING', class: 'bg-blue-100 text-blue-700', icon: Loader2 },
    printed: { label: 'PRINTED', class: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    failed: { label: 'FAILED', class: 'bg-red-100 text-red-700', icon: XCircle },
  };
  const cfg = config[status] ?? config.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 ${cfg.class} text-[10px] font-bold uppercase px-2 py-0.5 rounded`}>
      <Icon className={`h-3 w-3 ${status === 'printing' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

function PrinterModal({
  printer, onClose, onSaved,
}: {
  printer: Printer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(printer?.name ?? '');
  const [station, setStation] = useState(printer?.station ?? 'kitchen');
  const [connectionType, setConnectionType] = useState(printer?.connection_type ?? 'usb');
  const [ipAddress, setIpAddress] = useState(printer?.ip_address ?? '');
  const [port, setPort] = useState(printer?.port ?? 9100);
  const [usbName, setUsbName] = useState(printer?.usb_name ?? '');
  const [paperWidth, setPaperWidth] = useState(printer?.paper_width ?? 58);
  const [retryCount, setRetryCount] = useState(printer?.retry_count ?? 3);
  const [timeoutMs, setTimeoutMs] = useState(printer?.timeout_ms ?? 5000);
  const [enabled, setEnabled] = useState(printer?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        name, station, connectionType,
        ipAddress: connectionType === 'lan' ? ipAddress : null,
        port: connectionType === 'lan' ? Number(port) : null,
        usbName: connectionType === 'usb' ? usbName : null,
        paperWidth: Number(paperWidth),
        retryCount: Number(retryCount),
        timeoutMs: Number(timeoutMs),
        enabled,
      };
      if (printer) {
        await apiData(`/api/printers/${printer.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast.success('Printer yangilandi');
      } else {
        await apiData('/api/printers', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Printer yaratildi');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Saqlanmadi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            {printer ? 'Printerni tahrirlash' : 'Yangi printer'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Nomi</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Oshxona printeri" className="h-10" />
          </div>

          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Stansiya</label>
            <select value={station} onChange={e => setStation(e.target.value as any)} className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm">
              <option value="kitchen">KITCHEN (Oshxona)</option>
              <option value="kebab">KEBAB (Kabob)</option>
              <option value="cashier">CASHIER (Kassir)</option>
              <option value="bar">BAR</option>
              <option value="other">CUSTOM (Boshqa)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600 font-medium block mb-1">Ulanish turi</label>
            <div className="flex gap-2">
              <button
                onClick={() => setConnectionType('usb')}
                className={`flex-1 h-10 rounded-md border-2 text-sm font-medium flex items-center justify-center gap-1.5 ${connectionType === 'usb' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
              >
                <Usb className="h-4 w-4" /> USB
              </button>
              <button
                onClick={() => setConnectionType('lan')}
                className={`flex-1 h-10 rounded-md border-2 text-sm font-medium flex items-center justify-center gap-1.5 ${connectionType === 'lan' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
              >
                <Wifi className="h-4 w-4" /> LAN
              </button>
            </div>
          </div>

          {connectionType === 'lan' ? (
            <>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">IP manzil</label>
                <Input value={ipAddress} onChange={e => setIpAddress(e.target.value)} placeholder="192.168.1.50" className="h-10" />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Port</label>
                <Input type="number" value={port} onChange={e => setPort(Number(e.target.value))} className="h-10" />
              </div>
            </>
          ) : (
            <div>
              <label className="text-xs text-slate-600 font-medium block mb-1">USB nomi</label>
              <Input value={usbName} onChange={e => setUsbName(e.target.value)} placeholder="XP-58 (Oshxona)" className="h-10" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-slate-600 font-medium block mb-1">Paper</label>
              <select value={paperWidth} onChange={e => setPaperWidth(Number(e.target.value))} className="w-full h-10 px-2 border border-slate-300 rounded-md text-sm">
                <option value={58}>58mm</option>
                <option value={80}>80mm</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 font-medium block mb-1">Retry</label>
              <Input type="number" value={retryCount} onChange={e => setRetryCount(Number(e.target.value))} className="h-10" />
            </div>
            <div>
              <label className="text-xs text-slate-600 font-medium block mb-1">Timeout</label>
              <Input type="number" value={timeoutMs} onChange={e => setTimeoutMs(Number(e.target.value))} className="h-10" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded"
              id="enabled"
            />
            <label htmlFor="enabled" className="text-sm text-slate-700">Yoqilgan</label>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10">Bekor</Button>
          <Button onClick={handleSave} disabled={saving || !name} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Saqlash'}
          </Button>
        </div>
      </div>
    </div>
  );
}
