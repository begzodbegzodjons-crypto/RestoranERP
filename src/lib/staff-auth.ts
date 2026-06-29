// Staff auth helpers - kassir/ofitsiant uchun alohida auth
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export function generateStaffToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Hash PIN (PBKDF2 - simple)
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(pin, salt, 100000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const verify = crypto.pbkdf2Sync(pin, salt, 100000, 64, 'sha512').toString('hex')
  return hash === verify
}

export async function createStaffSession(staffId: string): Promise<string> {
  const token = generateStaffToken()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 12) // 12 hours

  await db.staffSession.create({
    data: { staffId, token, expiresAt }
  })

  return token
}

export async function getCurrentStaff() {
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_staff')?.value
  if (!token) return null

  const session = await db.staffSession.findUnique({
    where: { token },
    include: {
      staff: {
        include: { restaurant: true }
      }
    }
  })
  if (!session) return null

  if (session.expiresAt < new Date()) {
    await db.staffSession.delete({ where: { id: session.id } })
    return null
  }

  return session.staff
}

export async function deleteStaffSession(token: string) {
  try {
    await db.staffSession.delete({ where: { token } })
  } catch {}
}
