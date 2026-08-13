'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { LoginScreen } from '@/components/waiter/login-screen';
import { Header } from '@/components/waiter/header';
import { WaiterApp } from '@/components/waiter/waiter-app';
import { AdminPanel } from "@/components/admin/admin-panel";
import { StationScreen } from '@/components/station/station-screen';
import { CashierApp } from '@/components/cashier/cashier-app';
import { PrintersAdmin } from '@/components/admin/printers-admin';
import { WarehouseApp } from '@/components/warehouse/warehouse-app';
import { ReportsApp } from '@/components/reports/reports-app';
import { OfflineIndicator } from '@/components/offline-indicator';
import { BackupSecurityApp } from '@/components/admin/backup-security';

type View = 'waiter' | 'kitchen' | 'kebab' | 'cashier' | 'admin' | 'printers' | 'warehouse' | 'reports' | 'backup';

export default function Home() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>('waiter');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">Yuklanmoqda...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  // Determine which views the user can access based on role
  const canWaiter  = user.permissions.includes('*') ||
    user.permissions.includes('order.create') ||
    user.permissions.includes('station.kitchen.view') ||
    user.permissions.includes('station.kebab.view');
  const canKitchen = user.permissions.includes('*') ||
    user.permissions.includes('station.kitchen.view');
  const canKebab   = user.permissions.includes('*') ||
    user.permissions.includes('station.kebab.view');
  const canCashier = user.permissions.includes('*') ||
    user.permissions.includes('payment.create');
  const canAdmin   = user.permissions.includes('*') ||
    user.permissions.includes('printer.manage');
  const canWarehouse = user.permissions.includes('*') ||
    user.permissions.includes('inventory.read');
  const canReports = user.permissions.includes('*') ||
    user.permissions.includes('report.view');
  const canBackup = user.permissions.includes('*') ||
    user.permissions.includes('backup.manage');

  // Auto-route based on role
  if (user.roleName === 'kitchen' && view === 'waiter' && !canWaiter) { setView('kitchen'); return null; }
  if (user.roleName === 'kebab' && view === 'waiter' && !canWaiter) { setView('kebab'); return null; }
  if (user.roleName === 'cashier' && view === 'waiter' && !canWaiter) { setView('cashier'); return null; }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        onHome={() => setView('waiter')}
        viewSwitcher={
          (canWaiter || canKitchen || canKebab || canCashier || canAdmin || canWarehouse || canReports || canBackup) ? (
            <ViewSwitcher
              active={view}
              onChange={setView}
              canWaiter={canWaiter}
              canKitchen={canKitchen}
              canKebab={canKebab}
              canCashier={canCashier}
              canAdmin={canAdmin}
              canWarehouse={canWarehouse}
              canReports={canReports}
              canBackup={canBackup}
            />
          ) : null
        }
      />
      <main className="flex-1">
        {view === 'waiter' && canWaiter && <WaiterApp />}
        {view === 'kitchen' && canKitchen && <StationScreen station="kitchen" title="Oshxona ekrani" accentColor="orange" />}
        {view === 'kebab' && canKebab && <StationScreen station="kebab" title="Kabob ekrani" accentColor="red" />}
        {view === 'cashier' && canCashier && <CashierApp />}
        {view === 'printers' && canAdmin && <PrintersAdmin />}
        {view === 'warehouse' && canWarehouse && <WarehouseApp />}
        {view === 'reports' && canReports && <ReportsApp />}
        {view === 'backup' && canBackup && <BackupSecurityApp />}
        {!canWaiter && !canKitchen && !canKebab && !canCashier && !canAdmin && !canWarehouse && !canReports && !canBackup && (
          <div className="text-center py-12 text-slate-500">
            Sizda hech qanday tizimga ruxsat yo&apos;q. Administratorga murojaat qiling.
          </div>
        )}
      </main>
      <OfflineIndicator />
    </div>
  );
}

function ViewSwitcher({
  active, onChange, canWaiter, canKitchen, canKebab, canCashier, canAdmin, canWarehouse, canReports, canBackup,
}: {
  active: View;
  onChange: (v: View) => void;
  canWaiter: boolean;
  canKitchen: boolean;
  canKebab: boolean;
  canCashier: boolean;
  canAdmin: boolean;
  canWarehouse: boolean;
  canReports: boolean;
  canBackup: boolean;
}) {
  const buttons: Array<{ v: View; label: string; emoji: string; show: boolean }> = [
    { v: 'waiter',  label: 'Ofitsiant', emoji: '🍽️', show: canWaiter },
    { v: 'kitchen', label: 'Oshxona',   emoji: '👨‍🍳', show: canKitchen },
    { v: 'kebab',   label: 'Kabob',     emoji: '🍢',  show: canKebab },
    { v: 'cashier', label: 'Kassir',    emoji: '💳',  show: canCashier },
    { v: 'admin',   label: 'Boshqaruv', emoji: '⚙️',  show: canAdmin },
    { v: 'printers',label: 'Printer',   emoji: '🖨️',  show: canAdmin },
    { v: 'warehouse',label: 'Ombor',    emoji: '📦',  show: canWarehouse },
    { v: 'reports', label: 'Hisobot',   emoji: '📊',  show: canReports },
    { v: 'backup',  label: 'Backup',    emoji: '🛡️',  show: canBackup },
  ];
  const visible = buttons.filter(b => b.show);
  if (visible.length <= 1) return null;
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full">
      {visible.map(b => (
        <button
          key={b.v}
          onClick={() => onChange(b.v)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            active === b.v
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="mr-1">{b.emoji}</span>
          {b.label}
        </button>
      ))}
    </div>
  );
}
