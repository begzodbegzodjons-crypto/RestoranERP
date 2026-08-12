'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { CartItem } from './types';

interface CartContextValue {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  total: number;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === item.productId);
      if (existing) {
        return prev.map(i =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setCart(prev =>
      quantity <= 0
        ? prev.filter(i => i.productId !== productId)
        : prev.map(i => i.productId === productId ? { ...i, quantity } : i)
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const total = cart.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQuantity, removeItem, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
