'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { LoginScreen } from '@/components/waiter/login-screen';
import { TablesScreen } from '@/components/waiter/tables-screen';
import { OrderScreen } from '@/components/waiter/order-screen';
import { MenuBrowser } from '@/components/waiter/menu-browser';
import { CartScreen } from '@/components/waiter/cart-screen';
import { OrderStatusScreen } from '@/components/waiter/order-status-screen';
import { Header } from '@/components/waiter/header';
import type { Table, Order } from '@/lib/types';

type Screen =
  | { name: 'tables' }
  | { name: 'order'; tableId: string; orderId?: string }
  | { name: 'menu'; tableId: string; orderId?: string }
  | { name: 'cart'; tableId: string; orderId?: string }
  | { name: 'status'; orderId: string };

export default function Home() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState<Screen>({ name: 'tables' });

  // If not logged in → show login
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

  // Verify waiter has waiter permission (or admin who can also act as waiter)
  const canUseWaiter = user.permissions.includes('*') ||
    user.permissions.includes('order.create') ||
    user.permissions.includes('station.kitchen.view') ||
    user.permissions.includes('station.kebab.view');
  if (!canUseWaiter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Ruxsat yo'q</h1>
          <p className="text-slate-500 text-sm">Sizda ofitsiant huquqlari yo'q.</p>
          <button
            onClick={() => { localStorage.clear(); window.location.href = '/'; }}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm"
          >
            Chiqish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header onHome={() => setScreen({ name: 'tables' })} />
      <main className="flex-1">
        {screen.name === 'tables' && (
          <TablesScreen onSelectTable={(tableId, orderId) => setScreen({ name: 'order', tableId, orderId })} />
        )}
        {screen.name === 'order' && (
          <OrderScreen
            tableId={screen.tableId}
            orderId={screen.orderId}
            onAddItems={() => setScreen({ name: 'menu', tableId: screen.tableId, orderId: screen.orderId })}
            onViewStatus={(orderId) => setScreen({ name: 'status', orderId })}
            onBack={() => setScreen({ name: 'tables' })}
          />
        )}
        {screen.name === 'menu' && (
          <MenuBrowser
            onAddToCart={() => setScreen({ name: 'cart', tableId: screen.tableId, orderId: screen.orderId })}
            onBack={() => setScreen({ name: 'order', tableId: screen.tableId, orderId: screen.orderId })}
          />
        )}
        {screen.name === 'cart' && (
          <CartScreen
            tableId={screen.tableId}
            orderId={screen.orderId}
            onOrderCreated={(orderId) => setScreen({ name: 'order', tableId: screen.tableId, orderId })}
            onBack={() => setScreen({ name: 'menu', tableId: screen.tableId, orderId: screen.orderId })}
          />
        )}
        {screen.name === 'status' && (
          <OrderStatusScreen
            orderId={screen.orderId}
            onBack={() => setScreen({ name: 'tables' })}
          />
        )}
      </main>
    </div>
  );
}
