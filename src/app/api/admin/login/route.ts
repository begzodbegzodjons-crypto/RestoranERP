import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const ADMIN_PASSWORD = 'Balandtoglar1'

// POST /api/admin/login - admin kabinetga kirish
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { password } = body

    if (!password || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Noto\'g\'ri maxfiy kalit' }, { status: 401 })
    }

    // Create admin session token (separate from restaurant session)
    const token = crypto.randomBytes(32).toString('hex')

    const response = NextResponse.json({ success: true, token })
    response.cookies.set('erp_admin', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/'
    })

    return response
  } catch (e: any) {
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 })
  }
}

// GET /api/admin/login - admin session check
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('erp_admin')?.value
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({ authenticated: true })
}

// POST /api/admin/login (DELETE method via ?action=logout)
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('erp_admin')
  return response
}
