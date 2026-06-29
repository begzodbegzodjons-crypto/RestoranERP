'use client'

import { useState } from 'react'
import DashboardView from './DashboardView'
import POSView from './POSView'
import ProductsView from './ProductsView'
import IngredientsView from './IngredientsView'
import PurchasesView from './PurchasesView'
import SalesView from './SalesView'
import ReportsView from './ReportsView'
import SettingsView from './SettingsView'
import StaffMode from './StaffMode'
import ShiftsView from './ShiftsView'
import KitchenDisplayView from './KitchenDisplayView'
import ExportView from './ExportView'
import NotificationsView from './NotificationsView'
import { CustomersView, StaffView, TablesViewWithRooms, SuppliersView, CategoriesView, ExpensesView, ReservationsView, CouponsView, DebtsView, RoomsView } from './CrudViews'

type View = 'dashboard' | 'pos' | 'products' | 'ingredients' | 'purchases' | 'sales' | 'categories' | 'customers' | 'staff' | 'tables' | 'rooms' | 'suppliers' | 'expenses' | 'reports' | 'settings' | 'staffmode' | 'shifts' | 'kitchen' | 'reservations' | 'coupons' | 'debts' | 'export' | 'notifications'

type Restaurant = {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  currency: string
}

type Access = {
  state: 'trial' | 'active' | 'blocked'
  daysLeft: number
  endDate: string
  message: string
}

const NAV: { section: string; items: { key: View; label: string; icon: string }[] }[] = [
  {
    section: 'Asosiy',
    items: [
      { key: 'dashboard', label: 'Boshqaruv paneli', icon: '📊' },
      { key: 'pos', label: 'POS Kassa', icon: '💳' },
      { key: 'reports', label: 'Hisobotlar', icon: '📈' },
      { key: 'notifications', label: 'Bildirishnomalar', icon: '🔔' }
    ]
  },
  {
    section: 'Mahsulotlar',
    items: [
      { key: 'products', label: 'Taomlar & Retsept', icon: '🍽️' },
      { key: 'categories', label: 'Kategoriyalar', icon: '🏷️' }
    ]
  },
  {
    section: 'Ombor',
    items: [
      { key: 'ingredients', label: 'Ombor mahsulotlari', icon: '📦' },
      { key: 'purchases', label: 'Kirim (sotib olish)', icon: '🚚' },
      { key: 'suppliers', label: 'Yetkazib beruvchilar', icon: '🏪' }
    ]
  },
  {
    section: 'Savdo',
    items: [
      { key: 'sales', label: 'Savdo tarixi', icon: '🧾' },
      { key: 'customers', label: 'Mijozlar (CRM)', icon: '👥' },
      { key: 'debts', label: 'Mijoz qarzlari', icon: '💳' }
    ]
  },
  {
    section: 'Marketing',
    items: [
      { key: 'coupons', label: 'Kuponlar', icon: '🏷️' },
      { key: 'reservations', label: 'Rezervatsiyalar', icon: '📅' }
    ]
  },
  {
    section: 'Boshqaruv',
    items: [
      { key: 'staff', label: 'Xodimlar', icon: '👷' },
      { key: 'rooms', label: 'Xonalar (Zal/VIP)', icon: '🏠' },
      { key: 'tables', label: 'Stollar', icon: '🪑' },
      { key: 'expenses', label: 'Chiqimlar', icon: '💸' },
      { key: 'shifts', label: 'Smenalar (Kassa)', icon: '💰' },
      { key: 'kitchen', label: 'Oshpaz ekrani (KDS)', icon: '🍳' },
      { key: 'export', label: 'Eksport (Excel)', icon: '📤' },
      { key: 'settings', label: 'Sozlamalar', icon: '⚙️' }
    ]
  },
  {
    section: 'POS tizimi',
    items: [
      { key: 'staffmode', label: '👤 Xodim kirishi (POS)', icon: '🔌' }
    ]
  }
]

export default function DashboardLayout({
  restaurant,
  access,
  onLogout
}: {
  restaurant: Restaurant
  access: Access
  onLogout: () => void
}) {
  const [view, setView] = useState<View>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const stateBadge = {
    trial: { label: 'Sinov', cls: 'bg-amber-100 text-amber-700' },
    active: { label: 'Aktiv', cls: 'bg-emerald-100 text-emerald-700' },
    blocked: { label: 'Blok', cls: 'bg-red-100 text-red-700' }
  }
  const badge = stateBadge[access.state]

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <DashboardView restaurantName={restaurant.name} />
      case 'pos': return <POSView />
      case 'products': return <ProductsView />
      case 'ingredients': return <IngredientsView />
      case 'purchases': return <PurchasesView />
      case 'sales': return <SalesView />
      case 'categories': return <CategoriesView />
      case 'customers': return <CustomersView />
      case 'staff': return <StaffView />
      case 'tables': return <TablesViewWithRooms />
      case 'rooms': return <RoomsView />
      case 'suppliers': return <SuppliersView />
      case 'expenses': return <ExpensesView />
      case 'reports': return <ReportsView />
      case 'settings': return <SettingsView restaurant={restaurant} access={access} onLogout={onLogout} />
      case 'shifts': return <ShiftsView />
      case 'kitchen': return <KitchenDisplayView />
      case 'reservations': return <ReservationsView />
      case 'coupons': return <CouponsView />
      case 'debts': return <DebtsView />
      case 'export': return <ExportView />
      case 'notifications': return <NotificationsView />
      case 'staffmode': return (
        <div className="-m-4 sm:-m-6 lg:-m-8">
          <StaffMode
            restaurantId={restaurant.id}
            restaurantName={restaurant.name}
            onExit={() => setView('dashboard')}
          />
        </div>
      )
      default: return null
    }
  }

  const nav = (
    <>
      {NAV.map(group => (
        <div key={group.section} className="mb-5">
          <div className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{group.section}</div>
          {group.items.map(item => (
            <button
              key={item.key}
              onClick={() => { setView(item.key); setMobileNavOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                view === item.key
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col fixed h-screen">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-white">
                <path d="M3 11h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M5 11v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6M9 3v2M15 3v2" />
                <circle cx="9" cy="15" r="1" />
                <circle cx="15" cy="15" r="1" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 truncate">{restaurant.name}</div>
              <div className="text-xs text-slate-500">OshxonaERP</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-3">
          {nav}
        </div>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3 px-3">
            <span className="text-xs text-slate-500">Obuna:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
              {badge.label} {access.daysLeft > 0 && `(${access.daysLeft}k)`}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            🚪 Chiqish
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-30 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileNavOpen(true)} className="p-2 -ml-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-slate-700">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-white">
              <path d="M3 11h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M5 11v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
          </div>
          <span className="font-bold text-slate-900 text-sm">{restaurant.name}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileNavOpen(false)}>
          <aside className="bg-white w-72 h-full overflow-y-auto custom-scroll p-3" onClick={e => e.stopPropagation()}>
            {nav}
            <button
              onClick={onLogout}
              className="w-full mt-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              🚪 Chiqish
            </button>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-72 pt-16 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {renderView()}
        </div>
      </main>
    </div>
  )
}
