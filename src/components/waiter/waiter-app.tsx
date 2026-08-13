'use client';

import { useState } from 'react';
import { TablesScreen } from '@/components/waiter/tables-screen';
import { OrderScreen } from '@/components/waiter/order-screen';
import { MenuBrowser } from '@/components/waiter/menu-browser';
import { CartScreen } from '@/components/waiter/cart-screen';
import { OrderStatusScreen } from '@/components/waiter/order-status-screen';

type Screen =
  | { name: 'tables' }
  | { name: 'order'; tableId: string; orderId?: string }
  | { name: 'menu'; tableId: string; orderId?: string }
  | { name: 'cart'; tableId: string; orderId?: string }
  | { name: 'status'; orderId: string };

export function WaiterApp() {
  const [screen, setScreen] = useState<Screen>({ name: 'tables' });

  return (
    <>
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
    </>
  );
}
