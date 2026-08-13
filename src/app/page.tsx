'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { LoginScreen } from '@/components/waiter/login-screen';
import { Header } from '@/components/waiter/header';
import { WaiterApp } from '@/components/waiter/waiter-app';
import { StationScreen } from '@/components/station/station-screen';

type View = 'waiter' | 'kitchen' | 'kebab';

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

  // If current view not allowed, switch to allowed view
  let activeView = view;
  if (activeView === 'kitchen' && !canKitchen) activeView = canWaiter ? 'waiter' : canKebab ? 'kebab' : 'waiter';
  if (activeView === 'kebab' && !canKebab) activeView = canWaiter ? 'waiter' : canKitchen ? 'kitchen' : 'waiter';
  if (activeView === 'waiter' && !canWaiter) activeView = canKitchen ? 'kitchen' : canKebab ? 'kebab' : 'kitchen';

  // Auto-route based on role (initial)
  if (user.roleName === 'kitchen' && view === 'waiter' && !canWaiter) {
    setView('kitchen');
    return null;
  }
  if (user.roleName === 'kebab' && view === 'waiter' && !canWaiter) {
    setView('kebab');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        onHome={() => setView('waiter')}
        viewSwitcher={
          (canWaiter || canKitchen || canKebab) ? (
            <ViewSwitcher
              active={activeView}
              onChange={setView}
              canWaiter={canWaiter}
              canKitchen={canKitchen}
              canKebab={canKebab}
            />
          ) : null
        }
      />
      <main className="flex-1">
        {activeView === 'waiter' && canWaiter && <WaiterApp />}
        {activeView === 'kitchen' && canKitchen && <StationScreen station="kitchen" title="Oshxona ekrani" accentColor="orange" />}
        {activeView === 'kebab' && canKebab && <StationScreen station="kebab" title="Kabob ekrani" accentColor="red" />}
        {!canWaiter && !canKitchen && !canKebab && (
          <div className="text-center py-12 text-slate-500">
            Sizda hech qanday tizimga ruxsat yo&apos;q. Administratorga murojaat qiling.
          </div>
        )}
      </main>
    </div>
  );
}

function ViewSwitcher({
  active, onChange, canWaiter, canKitchen, canKebab,
}: {
  active: View;
  onChange: (v: View) => void;
  canWaiter: boolean;
  canKitchen: boolean;
  canKebab: boolean;
}) {
  const buttons: Array<{ v: View; label: string; emoji: string; show: boolean }> = [
    { v: 'waiter',  label: 'Ofitsiant', emoji: '🍽️', show: canWaiter },
    { v: 'kitchen', label: 'Oshxona',   emoji: '👨‍🍳', show: canKitchen },
    { v: 'kebab',   label: 'Kabob',     emoji: '🍢',  show: canKebab },
  ];
  const visible = buttons.filter(b => b.show);
  if (visible.length <= 1) return null;
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
      {visible.map(b => (
        <button
          key={b.v}
          onClick={() => onChange(b.v)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
