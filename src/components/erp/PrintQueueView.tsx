'use client'

import { useState, useEffect } from 'react'
import { api, toast, formatDateTime } from './utils'

type PrintJobGroup = {
  station: { id: string; name: string; description: string | null }
  jobs: Array<{
    id: string
    status: string
    content: {
      orderNo: string
      table: string
      waiter: string
      createdAt: string
      items: Array<{ productName: string; quantity: number; notes: string | null }>
    }
    createdAt: string
    printedAt: string | null
    order: { id: string; invoiceNo: string; table: { name: string }; waiter: { name: string } }
  }>
  count: number
}

export default function PrintQueueView() {
  const [groups, setGroups] = useState<PrintJobGroup[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res = await api('/api/print-jobs?status=pending')
      setGroups(res.items || [])
      setPendingCount(res.pendingCount || 0)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Auto-refresh every 5 seconds for real-time updates
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const printJob = (job: PrintJobGroup['jobs'][0], stationName: string) => {
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) {
      toast.error('Pop-up bloklangan. Iltimos, ruxsat bering.')
      return
    }

    const c = job.content
    const itemsHtml = c.items.map((it: any) => `
      <tr>
        <td style="padding:3px 0;font-size:14px;font-weight:bold;">${it.quantity}×</td>
        <td style="padding:3px 0;font-size:14px;">${it.productName}${it.notes ? `<br><small style="color:#666;">📝 ${it.notes}</small>` : ''}</td>
      </tr>
    `).join('')

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${stationName} - ${c.table}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; padding: 8px; width: 80mm; color: #000; }
          .center { text-align: center; }
          .header { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
          .station { font-size: 12px; color: #666; margin-bottom: 8px; }
          .info { font-size: 12px; margin-bottom: 8px; }
          .info div { padding: 1px 0; }
          hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
          table { width: 100%; font-size: 14px; }
          td { vertical-align: top; }
          .qty { font-weight: bold; width: 30px; }
        </style>
      </head>
      <body>
        <div class="center header">${stationName}</div>
        <div class="center station">${c.items.length} ta buyurtma</div>
        <hr>
        <div class="info">
          <div><b>Stol:</b> ${c.table}</div>
          <div><b>Ofitsiant:</b> ${c.waiter}</div>
          <div><b>Buyurtma #:</b> ${c.orderNo}</div>
          <div><b>Vaqt:</b> ${new Date(c.createdAt).toLocaleString('uz-UZ')}</div>
        </div>
        <hr>
        <table>
          ${itemsHtml}
        </table>
        <hr>
        <div class="center" style="font-size: 11px; margin-top: 8px;">
          *** ${stationName} ***
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 1000);
          };
        </script>
      </body>
      </html>
    `)
    win.document.close()
  }

  const printAll = (group: PrintJobGroup) => {
    group.jobs.forEach((job, i) => {
      setTimeout(() => printJob(job, group.station.name), i * 1500)
    })
    toast.success(`${group.station.name}: ${group.jobs.length} ta chek chop etilmoqda...`)
  }

  const markPrinted = async (jobId: string) => {
    try {
      await api(`/api/print-jobs/${jobId}/printed`, { method: 'POST' })
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const markAllPrinted = async (group: PrintJobGroup) => {
    for (const job of group.jobs) {
      await markPrinted(job.id)
    }
    toast.success(`${group.station.name}: barchasi chop etilgan deb belgilandi`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-emerald-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🖨️ Print navbati</h2>
          <p className="text-slate-500 text-sm">
            {pendingCount > 0 ? `⚠️ ${pendingCount} ta chop etilmagan chek` : '✓ Barcha cheklar chop etilgan'}
            {' • '}Har 5 soniyada avtomatik yangilanadi
          </p>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100">
          ↻ Yangilash
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <div className="text-5xl mb-3">✓</div>
          Chop etilmagan cheklar yo'q. Ofitsiantlar buyurtma bosganda, cheklar shu yerda paydo bo'ladi.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.station.id} className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
              {/* Printer header */}
              <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🖨️</span>
                  <div>
                    <div className="font-bold text-lg">{group.station.name}</div>
                    {group.station.description && <div className="text-xs text-slate-300">{group.station.description}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-amber-500">
                    {group.jobs.length} ta kutilmoqda
                  </span>
                  <button
                    onClick={() => printAll(group)}
                    className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm"
                  >
                    🖨️ Hammasini chop etish
                  </button>
                  <button
                    onClick={() => markAllPrinted(group)}
                    className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-medium text-sm"
                  >
                    ✓ Chop etilgan
                  </button>
                </div>
              </div>

              {/* Jobs list */}
              <div className="divide-y divide-slate-100">
                {group.jobs.map(job => (
                  <div key={job.id} className="p-4 hover:bg-slate-50 flex items-start gap-4">
                    <div className="flex-shrink-0 w-20 text-center">
                      <div className="bg-slate-900 text-white rounded-lg py-2 px-3">
                        <div className="text-xs text-slate-300">Stol</div>
                        <div className="font-bold text-lg">{job.content.table}</div>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-xs text-slate-500">{job.content.orderNo}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{job.content.waiter}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{formatDateTime(job.createdAt)}</span>
                      </div>
                      <div className="space-y-0.5">
                        {job.content.items.map((it, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-emerald-600 w-8">{it.quantity}×</span>
                            <span className="font-medium text-slate-900">{it.productName}</span>
                            {it.notes && <span className="text-xs text-amber-600 italic">📝 {it.notes}</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => printJob(job, group.station.name)}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800"
                      >
                        🖨️ Chop etish
                      </button>
                      <button
                        onClick={() => markPrinted(job.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100"
                      >
                        ✓ Tayyor
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
