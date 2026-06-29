import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentStaff } from '@/lib/staff-auth'

// GET /api/print-jobs - print navbati (kassir uchun)
// ?status=pending|printed|all (default: pending)
export async function GET(req: NextRequest) {
  try {
    const staff = await getCurrentStaff()
    if (!staff) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'

    const jobs = await db.printJob.findMany({
      where: {
        restaurantId: staff.restaurantId,
        ...(status !== 'all' ? { status } : {})
      },
      include: {
        printerStation: true,
        order: {
          include: {
            table: true,
            waiter: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    // Group by printer station
    const byPrinter = new Map<string, {
      station: any
      jobs: any[]
      count: number
    }>()

    for (const job of jobs) {
      const stationId = job.printerStationId
      if (!byPrinter.has(stationId)) {
        byPrinter.set(stationId, {
          station: job.printerStation,
          jobs: [],
          count: 0
        })
      }
      const group = byPrinter.get(stationId)!
      group.jobs.push({
        id: job.id,
        status: job.status,
        content: JSON.parse(job.content),
        createdAt: job.createdAt,
        printedAt: job.printedAt,
        order: {
          id: job.order.id,
          invoiceNo: job.order.invoiceNo,
          table: job.order.table,
          waiter: job.order.waiter
        }
      })
      group.count++
    }

    // Pending count
    const pendingCount = jobs.filter(j => j.status === 'pending').length

    return NextResponse.json({
      items: Array.from(byPrinter.values()),
      pendingCount,
      totalJobs: jobs.length
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
