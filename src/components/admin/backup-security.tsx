'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiData, ApiError } from '@/lib/api';
import {
  Loader2, RefreshCw, Plus, Shield, Database, CheckCircle2, XCircle,
  AlertTriangle, History, Download, Upload, Lock, X, FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Backup {
  id: string;
  type: string;
  status: string;
  tables_count: number;
  rows_count: number;
  size_bytes: number;
  checksum: string | null;
  note: string | null;
  started_at: string;
  completed_at: string | null;
  triggered_by_name: string | null;
  created_at: string;
}

interface AuditLog {
  id: number;
  restaurant_id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  action: string;
  entity: string;
  entity_id: string;
  ip: string;
  user_agent: string;
  before: any;
  after: any;
  created_at: string;
}

type Tab = 'backups' | 'audit';

export function BackupSecurityApp() {
  const [tab, setTab] = useState<Tab>('backups');
  const [backups, setBackups] = useState<Backup[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<Backup | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      const data = await apiData<Backup[]>('/api/backups');
      setBackups(data ?? []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Backuplar yuklanmadi');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      const data = await apiData<AuditLog[]>('/api/audit-logs');
      setAuditLogs(data ?? []);
    } catch {
      setAuditLogs([]);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchAudit();
  }, [fetchBackups, fetchAudit]);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const result = await apiData<{ id: string; status: string; tables_count: number; rows_count: number; checksum: string }>('/api/backups', {
        method: 'POST',
        body: JSON.stringify({ note: 'Manual backup' }),
      });
      toast.success('Backup yaratildi!', {
        description: `${result.tables_count} jadval, ${result.rows_count} qator`,
      });
      fetchBackups();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Backup yaratilmadi');
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async (backup: Backup) => {
    setVerifyTarget(backup);
    try {
      const result = await apiData<{ verified: boolean; tables: any; rows: any; checksum: any }>(`/api/backups/${backup.id}/verify`, {
        method: 'POST',
      });
      if (result.verified) {
        toast.success('Backup tekshirildi — MUVOFIQ!', {
          description: `${result.tables.backup} jadval, ${result.rows.backup} qator`,
        });
      } else {
        toast.warning('Backup tekshirildi — MOS KELMADI', {
          description: `Jadval: ${result.tables.match ? 'OK' : 'XATO'}, Qator: ${result.rows.match ? 'OK' : 'XATO'}`,
        });
      }
      fetchBackups();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Verify amalga oshmadi');
    } finally {
      setVerifyTarget(null);
    }
  };

  const handleRestore = async (backup: Backup, confirmText: string, reason: string) => {
    try {
      const result = await apiData(`/api/backups/${backup.id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ confirm: confirmText, reason }),
      });
      toast.success('Restore boshlandi', {
        description: result?.message ?? 'TiDB Cloud orqali yakunlanadi',
      });
      setRestoreTarget(null);
      fetchBackups();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Restore amalga oshmadi');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-24">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4">
        <button
          onClick={() => setTab('backups')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md ${tab === 'backups' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
        >
          <Database className="h-4 w-4" /> Backup ({backups.length})
        </button>
        <button
          onClick={() => setTab('audit')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md ${tab === 'audit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
        >
          <Shield className="h-4 w-4" /> Audit log ({auditLogs.length})
        </button>
      </div>

      {tab === 'backups' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">Backup tarixi</h2>
            <Button size="sm" onClick={handleCreateBackup} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Yangi backup</>}
            </Button>
          </div>

          {/* Security status */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            <div className="text-sm text-emerald-700">
              <span className="font-medium">Xavfsizlik tizimi faol:</span> Helmet (CSP, HSTS, XSS) · bcrypt · RBAC · Rate limiting · Audit log · SQL injection protection
            </div>
          </div>

          <div className="space-y-2">
            {backups.map(b => (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${b.status === 'completed' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                      {b.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Loader2 className="h-5 w-5 text-amber-600" />}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        {b.type === 'manual' ? 'Qo\'lda backup' : 'Avtomatik backup'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(b.created_at).toLocaleString('uz-UZ')} · {b.triggered_by_name ?? 'Tizim'}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${b.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {b.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 mb-2">
                  <div>Jadvallar: <span className="font-bold text-slate-900">{b.tables_count ?? 0}</span></div>
                  <div>Qatorlar: <span className="font-bold text-slate-900">{Number(b.rows_count ?? 0).toLocaleString('uz-UZ')}</span></div>
                  <div>Hajm: <span className="font-bold text-slate-900">{(Number(b.size_bytes ?? 0) / 1024).toFixed(0)} KB</span></div>
                </div>

                {b.checksum && (
                  <div className="text-[10px] text-slate-400 mb-2 font-mono truncate">
                    SHA-256: {b.checksum.substring(0, 32)}...
                  </div>
                )}

                {b.note && (
                  <div className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded mb-2">{b.note}</div>
                )}

                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => handleVerify(b)} disabled={verifyTarget?.id === b.id} className="flex-1 h-8 text-xs">
                    {verifyTarget?.id === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><FileCheck className="h-3.5 w-3.5 mr-1" /> Tekshirish</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRestoreTarget(b)} className="flex-1 h-8 text-xs text-red-600 hover:bg-red-50">
                    <Upload className="h-3.5 w-3.5 mr-1" /> Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Restore confirmation modal */}
          {restoreTarget && (
            <RestoreModal
              backup={restoreTarget}
              onClose={() => setRestoreTarget(null)}
              onConfirm={handleRestore}
            />
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Audit log ({auditLogs.length})</h2>
          <div className="space-y-1.5">
            {auditLogs.map(log => {
              const actionColors: Record<string, string> = {
                login: 'bg-blue-100 text-blue-700',
                logout: 'bg-slate-100 text-slate-600',
                create: 'bg-emerald-100 text-emerald-700',
                update: 'bg-amber-100 text-amber-700',
                delete: 'bg-red-100 text-red-700',
                pay: 'bg-emerald-100 text-emerald-700',
                refund: 'bg-red-100 text-red-700',
                adjust: 'bg-violet-100 text-violet-700',
                cancel: 'bg-red-100 text-red-700',
                create_backup: 'bg-blue-100 text-blue-700',
                restore_backup: 'bg-amber-100 text-amber-700',
                verify_backup: 'bg-sky-100 text-sky-700',
              };
              const color = actionColors[log.action] ?? 'bg-slate-100 text-slate-600';
              return (
                <div key={log.id} className="bg-white rounded-lg border border-slate-100 p-2.5 flex items-center gap-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded whitespace-nowrap ${color}`}>
                    {log.action}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900">
                      <span className="font-medium">{log.user_name ?? 'Tizim'}</span>
                      <span className="text-slate-500"> · {log.entity}</span>
                      {log.entity_id && <span className="text-slate-400 text-xs"> · #{String(log.entity_id).substring(0, 8)}</span>}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(log.created_at).toLocaleString('uz-UZ')} · IP: {log.ip ?? '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RestoreModal({ backup, onClose, onConfirm }: { backup: Backup; onClose: () => void; onConfirm: (backup: Backup, confirm: string, reason: string) => void }) {
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const canConfirm = confirmText === 'RESTORE' && reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-red-600">Restore tasdiqlash</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-700">
            <strong>DIQQAT!</strong> Bu amal hozirgi ma'lumotlarni backup holatiga qaytaradi.
            Bu amalni bekor qilib bo'lmaydi!
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-slate-600">
            <div>Backup: {backup.type} · {new Date(backup.created_at).toLocaleString('uz-UZ')}</div>
            <div>Jadvallar: {backup.tables_count} · Qatorlar: {Number(backup.rows_count).toLocaleString('uz-UZ')}</div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tasdiqlash so'zi</label>
            <Input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="RESTORE"
              className={`h-10 ${confirmText && confirmText !== 'RESTORE' ? 'border-red-300' : ''}`}
            />
            <div className="text-[10px] text-slate-400 mt-0.5">Davom etish uchun "RESTORE" so'zini kiriting</div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Sabab</label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Restore sababi..."
              className="h-10"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10">Bekor</Button>
          <Button
            onClick={() => onConfirm(backup, confirmText, reason)}
            disabled={!canConfirm}
            className="flex-1 h-10 bg-red-600 hover:bg-red-700"
          >
            <Lock className="h-4 w-4 mr-1" /> Restore qilish
          </Button>
        </div>
      </div>
    </div>
  );
}
