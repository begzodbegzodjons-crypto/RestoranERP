'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'

// Format number to UZS
export function formatMoney(amount: number, currency = 'UZS'): string {
  if (!amount || isNaN(amount)) return '0 ' + currency
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + ' ' + currency
}

export function formatNumber(n: number, digits = 2): string {
  if (n == null || isNaN(n)) return '0'
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: digits }).format(n)
}

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// Generic API fetcher with error handling
export async function api<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
    ...opts
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'So\'rov xatosi')
  }
  return data
}

// Modal component
export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
        )}
        <div className="overflow-y-auto custom-scroll p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

// Confirm dialog
export function useConfirm() {
  const [state, setState] = useState<{ open: boolean; msg: string; resolve?: (ok: boolean) => void }>({
    open: false, msg: ''
  })

  const confirm = (msg: string): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ open: true, msg, resolve })
    })
  }

  const close = (ok: boolean) => {
    state.resolve?.(ok)
    setState({ open: false, msg: '', resolve: undefined })
  }

  return {
    confirm,
    dialog: (
      <Modal open={state.open} onClose={() => close(false)} title="Tasdiqlash" size="sm">
        <p className="text-gray-700 mb-6">{state.msg}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => close(false)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
          >
            Bekor qilish
          </button>
          <button
            onClick={() => close(true)}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 font-medium"
          >
            Tasdiqlash
          </button>
        </div>
      </Modal>
    )
  }
}

// Toast helper - use sonner directly
export { toast }
