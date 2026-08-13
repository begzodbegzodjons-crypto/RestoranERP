'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiData, ApiError } from '@/lib/api';
import type { Category, Product, CartItem } from '@/lib/types';
import { Loader2, ArrowLeft, Search, Minus, Plus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useCart } from '@/lib/cart-context';

interface MenuBrowserProps {
  onAddToCart: () => void;
  onBack: () => void;
}

const STATION_COLORS: Record<string, string> = {
  kitchen: 'bg-orange-100 text-orange-700',
  kebab:   'bg-red-100 text-red-700',
  bar:     'bg-purple-100 text-purple-700',
  other:   'bg-slate-100 text-slate-700',
};

export function MenuBrowser({ onAddToCart, onBack }: MenuBrowserProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { cart, addToCart, updateQuantity } = useCart();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        apiData<Category[]>('/api/products/categories'),
        apiData<Product[]>('/api/products'),
      ]);
      setCategories(catRes ?? []);
      setProducts(prodRes ?? []);
      if ((catRes ?? []).length > 0 && !activeCategoryId) {
        setActiveCategoryId('all');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Menyu yuklanmadi');
    } finally {
      setLoading(false);
    }
  }, [activeCategoryId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategoryId && activeCategoryId !== 'all') {
      list = list.filter(p => p.category_id === activeCategoryId);
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategoryId, search]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Orqaga
        </Button>
        <h2 className="font-bold text-slate-900">Menyu</h2>
        <div className="w-20" />
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Mahsulot qidirish..."
          className="pl-10 h-11"
        />
      </div>

      {/* Categories tabs — horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
        <CategoryTab
          active={activeCategoryId === 'all'}
          onClick={() => setActiveCategoryId('all')}
          label="Hammasi"
          count={products.length}
        />
        {categories.map(c => (
          <CategoryTab
            key={c.id}
            active={activeCategoryId === c.id}
            onClick={() => setActiveCategoryId(c.id)}
            label={c.name}
            count={products.filter(p => p.category_id === c.id).length}
            station={c.station}
          />
        ))}
      </div>

      {/* Products grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          {search ? 'Mahsulot topilmadi' : 'Bu kategoriyada mahsulot yo\'q'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {filteredProducts.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              cartQty={cart.find(i => i.productId === p.id)?.quantity ?? 0}
              onAdd={() => {
                const price = Number(p.current_price ?? 0);
                addToCart({
                  productId: p.id,
                  name: p.name,
                  unitPrice: price,
                  costPrice: Number(p.cost_price ?? 0),
                  quantity: 1,
                  station: p.type,
                });
                toast.success('Savatga qo\'shildi', { description: p.name });
              }}
              onInc={() => updateQuantity(p.id, (cart.find(i => i.productId === p.id)?.quantity ?? 0) + 1)}
              onDec={() => updateQuantity(p.id, Math.max(0, (cart.find(i => i.productId === p.id)?.quantity ?? 0) - 1))}
            />
          ))}
        </div>
      )}

      {/* Floating cart bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-3xl mx-auto">
            <Button
              onClick={onAddToCart}
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-between px-5"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Savat ({cartCount})
              </span>
              <span className="font-bold">{cartTotal.toLocaleString('uz-UZ')} so'm</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryTab({
  active, onClick, label, count, station,
}: { active: boolean; onClick: () => void; label: string; count: number; station?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 h-10 px-4 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
        active
          ? 'bg-emerald-600 text-white shadow-md'
          : 'bg-white border border-slate-200 text-slate-700'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`text-xs ${active ? 'text-emerald-100' : 'text-slate-400'}`}>
          ({count})
        </span>
      )}
      {station && !active && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          station === 'kitchen' ? 'bg-orange-500' :
          station === 'kebab' ? 'bg-red-500' :
          station === 'bar' ? 'bg-purple-500' : 'bg-slate-400'
        }`} />
      )}
    </button>
  );
}

function ProductCard({
  product, cartQty, onAdd, onInc, onDec,
}: {
  product: Product;
  cartQty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const price = Number(product.current_price ?? 0);
  const stationClass = STATION_COLORS[product.type] ?? STATION_COLORS.other;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
      <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center relative">
        <span className="text-3xl font-bold text-slate-300 uppercase">{product.name.charAt(0)}</span>
        <span className={`absolute top-1.5 right-1.5 ${stationClass} text-[9px] font-bold uppercase px-1.5 py-0.5 rounded`}>
          {product.type}
        </span>
      </div>
      <div className="p-2.5 flex-1 flex flex-col">
        <div className="font-medium text-slate-900 text-sm leading-tight line-clamp-2 mb-1">{product.name}</div>
        <div className="font-bold text-emerald-700 text-base mb-2">{price.toLocaleString('uz-UZ')} so'm</div>

        {cartQty === 0 ? (
          <Button
            onClick={onAdd}
            size="sm"
            className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1" />
            Qo'shish
          </Button>
        ) : (
          <div className="flex items-center justify-between bg-emerald-50 rounded-lg p-1">
            <button
              onClick={onDec}
              className="w-8 h-8 rounded-md bg-white shadow-sm flex items-center justify-center active:scale-95"
              aria-label="Kamaytirish"
            >
              <Minus className="h-4 w-4 text-emerald-700" />
            </button>
            <span className="font-bold text-emerald-700">{cartQty}</span>
            <button
              onClick={onInc}
              className="w-8 h-8 rounded-md bg-white shadow-sm flex items-center justify-center active:scale-95"
              aria-label="Ko'paytirish"
            >
              <Plus className="h-4 w-4 text-emerald-700" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
