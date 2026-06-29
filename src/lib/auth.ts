// Auth helpers - restaurant multi-tenant authentication
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import crypto from 'crypto'

// Simple password hashing (PBKDF2)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex')
  return hash === verify
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Trial & activation logic
const TRIAL_DAYS = 10
const ACTIVATION_DAYS = 30

export function getTrialEnd(): Date {
  const d = new Date()
  d.setDate(d.getDate() + TRIAL_DAYS)
  return d
}

export function getActivationEnd(): Date {
  const d = new Date()
  d.setDate(d.getDate() + ACTIVATION_DAYS)
  return d
}

// Determine restaurant's current access status
export type AccessStatus = {
  state: 'trial' | 'active' | 'blocked'
  daysLeft: number
  endDate: Date
  message: string
}

export function getAccessStatus(restaurant: {
  status: string
  trialEnd: Date
  activatedAt: Date | null
  activationEnd: Date | null
}): AccessStatus {
  const now = new Date()

  // If activation is active and not expired
  if (restaurant.activatedAt && restaurant.activationEnd && restaurant.activationEnd > now) {
    const daysLeft = Math.ceil((restaurant.activationEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return {
      state: 'active',
      daysLeft,
      endDate: restaurant.activationEnd,
      message: `Aktiv holatda. ${daysLeft} kun qoldi.`
    }
  }

  // If trial is still active
  if (restaurant.trialEnd > now) {
    const daysLeft = Math.ceil((restaurant.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return {
      state: 'trial',
      daysLeft,
      endDate: restaurant.trialEnd,
      message: `Bepul sinov. ${daysLeft} kun qoldi.`
    }
  }

  // Blocked
  return {
    state: 'blocked',
    daysLeft: 0,
    endDate: restaurant.trialEnd,
    message: 'Sinov muddati tugadi. Dasturni faollashtirish uchun aktivatsiya kodini kiriting.'
  }
}

// Get current restaurant from session cookie
export async function getCurrentRestaurant() {
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_session')?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { token },
    include: { restaurant: true }
  })
  if (!session) return null

  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } })
    return null
  }

  return session.restaurant
}

// Create session
export async function createSession(restaurantId: string): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // session valid 7 days

  await db.session.create({
    data: { restaurantId, token, expiresAt }
  })

  return token
}

// Delete session
export async function deleteSession(token: string) {
  try {
    await db.session.delete({ where: { token } })
  } catch {
    // ignore
  }
}

// Generate random activation code (8 digits)
export function generateActivationCode(): string {
  // 8 random digits
  const code = Math.floor(10000000 + Math.random() * 90000000).toString()
  return code
}

// Format currency
export function formatMoney(amount: number, currency = 'UZS'): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(amount)) + ' ' + currency
}
