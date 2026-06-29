'use client'

import { useState, useEffect } from 'react'
import AuthPage from '@/components/erp/AuthPage'
import BlockedScreen from '@/components/erp/BlockedScreen'
import DashboardLayout from '@/components/erp/DashboardLayout'
import AdminPanel from '@/components/admin/AdminPanel'
import { api } from '@/components/erp/utils'

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

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [access, setAccess] = useState<Access | null>(null)
  const [isAdminMode, setIsAdminMode] = useState(false)

  const check = async () => {
    setLoading(true)
    try {
      const res = await api('/api/auth/me')
      if (res.authenticated) {
        setAuthed(true)
        setRestaurant(res.restaurant)
        setAccess(res.access)
      } else {
        setAuthed(false)
        setRestaurant(null)
        setAccess(null)
      }
    } catch {
      setAuthed(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Check if URL has ?adminkod
    const params = new URLSearchParams(window.location.search)
    if (params.has('adminkod')) {
      setIsAdminMode(true)
      setLoading(false)
      return
    }
    check()
  }, [])

  const onLogout = async () => {
    try {
      await fetch('/api/auth/me', { method: 'POST' })
    } catch {}
    setAuthed(false)
    setRestaurant(null)
    setAccess(null)
    // Clear URL
    window.history.replaceState({}, '', '/')
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30 mb-4 animate-pulse">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-white">
              <path d="M3 11h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M5 11v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6M9 3v2M15 3v2" />
              <circle cx="9" cy="15" r="1" />
              <circle cx="15" cy="15" r="1" />
            </svg>
          </div>
          <div className="text-slate-600 font-medium">OshxonaERP yuklanmoqda...</div>
        </div>
      </div>
    )
  }

  // Admin panel
  if (isAdminMode) {
    return <AdminPanel onClose={() => { setIsAdminMode(false); window.history.replaceState({}, '', '/'); check() }} />
  }

  // Authenticated
  if (authed && restaurant && access) {
    if (access.state === 'blocked') {
      return (
        <BlockedScreen
          restaurantName={restaurant.name}
          trialEnd={access.endDate}
          onActivated={check}
          onLogout={onLogout}
        />
      )
    }
    return <DashboardLayout restaurant={restaurant} access={access} onLogout={onLogout} />
  }

  // Not authenticated - login/register
  return <AuthPage onAuthed={check} />
}
