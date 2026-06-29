// Helper: verify admin session
import { cookies } from 'next/headers'

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_admin')?.value
  return !!token
}
