'use client'

import { useState, useEffect, useRef } from 'react'
import { api, toast } from './utils'

type AutoPrintJob = {
  id: string
  content: {
    orderNo: string
    table: string
    waiter: string
    createdAt: string
    items: Array<{ productName: string; quantity: number; notes: string | null }>
    printerStationName: string
  }
  printerStation: { id: string; name: string }
  createdAt: string
}

/**
 * AutoPrintMonitor - avtomatik print monitoring komponenti
 *
 * Har 2 soniyada /api/print-jobs/auto ni tekshiradi.
 * Agar yangi print job bo'lsa, avtomatik brauzer print dialogini ochadi.
 *
 * BU KOMPONENT HAR SAHIFADA ISHLASHI KERAK (DashboardLayout ga qo'yiladi)
 *
 * Brauzer print dialogi ochilganda:
 * - Kassir (yoki oshpaz/shashlikchi) printer tanlaydi
 * - Print qiladi
 * - Print job "printed" deb belgilanadi
 *
 * Mexanizm:
 * - autoPrintReady=true bo'lgan joblar avtomatik print qilinadi
 * - Kassir aralashmaydi
 * - Print dialog ochilganda job "printing" ga o'tadi (dublicat oldini olish)
 * - Print tugagach job "printed" ga o'tadi
 */

// Print status tracking - brauzerda saqlanadi (component re-render bo'lsa ham yo'qolmaydi)
const printingJobs = new Set<string>()

export default function AutoPrintMonitor() {
  const [enabled, setEnabled] = useState(true)
  const [currentJob, setCurrentJob] = useState<AutoPrintJob | null>(null)
  const [printing, setPrinting] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const printJob = async (job: AutoPrintJob) => {
    // Mark as printing to prevent duplicates
    printingJobs.add(job.id)
    setPrinting(true)
    setCurrentJob(job)

    try {
      // Create hidden iframe for printing (avoids navigation away from current page)
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)
      iframeRef.current = iframe

      const c = job.content
      const itemsHtml = c.items.map((it: any) => `
        <tr>
          <td style="padding:3px 0;font-size:14px;font-weight:bold;">${it.quantity}×</td>
          <td style="padding:3px 0;font-size:14px;">${it.productName}${it.notes ? `<br><small style="color:#666;">📝 ${it.notes}</small>` : ''}</td>
        </tr>
      `).join('')

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${job.printerStation.name} - ${c.table}</title>
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
          <div class="center header">${job.printerStation.name}</div>
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
            *** ${job.printerStation.name} ***
          </div>
        </body>
        </html>
      `

      iframe.onload = async () => {
        try {
          // Trigger print
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()

          // Mark job as printed in database
          await api(`/api/print-jobs/${job.id}/printed`, { method: 'POST' })

          // Wait a bit before removing iframe (let print dialog finish)
          setTimeout(() => {
            if (iframeRef.current && iframeRef.current.parentNode) {
              iframeRef.current.parentNode.removeChild(iframeRef.current)
              iframeRef.current = null
            }
            printingJobs.delete(job.id)
            setPrinting(false)
            setCurrentJob(null)
          }, 1000)
        } catch (e) {
          printingJobs.delete(job.id)
          setPrinting(false)
          setCurrentJob(null)
        }
      }

      // Write content to iframe
      iframe.srcdoc = html
    } catch (e: any) {
      printingJobs.delete(job.id)
      setPrinting(false)
      setCurrentJob(null)
    }
  }

  // Check for new print jobs every 2 seconds
  useEffect(() => {
    if (!enabled) return

    const checkForJobs = async () => {
      if (printing) return // Already printing, skip

      try {
        const res = await api('/api/print-jobs/auto')
        if (res.jobs && res.jobs.length > 0) {
          // Find a job that's not currently being printed
          const nextJob = res.jobs.find((j: AutoPrintJob) => !printingJobs.has(j.id))
          if (nextJob) {
            await printJob(nextJob)
          }
        }
      } catch (e) {
        // Silent fail - don't show errors every 2s
      }
    }

    // Check immediately
    checkForJobs()

    // Then every 2 seconds
    const interval = setInterval(checkForJobs, 2000)

    return () => clearInterval(interval)
  }, [enabled, printing])

  // Don't render anything visible - this is a background monitor
  // Only show a small status indicator
  return (
    <>
      {/* Hidden toggle button - bottom right corner */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white rounded-full shadow-lg border border-slate-200 px-3 py-2">
        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-3 h-3 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
          title={enabled ? 'Avtomatik print yoqilgan' : 'Avtomatik print o\'chirilgan'}
        />
        <span className="text-xs font-medium text-slate-600">
          {printing ? '🖨️ Chop etilmoqda...' : enabled ? '🖨️ Auto-print' : '🖨️ O\'chiq'}
        </span>
      </div>

      {/* Print notification (when printing) */}
      {currentJob && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white rounded-xl shadow-xl p-4 max-w-sm">
          <div className="flex items-center gap-3">
            <div className="text-2xl animate-bounce">🖨️</div>
            <div>
              <div className="font-bold">Avtomatik chop etish</div>
              <div className="text-sm text-emerald-50">
                {currentJob.printerStation.name} • Stol {currentJob.content.table}
              </div>
              <div className="text-xs text-emerald-100">
                {currentJob.content.items.length} ta buyurtma • {currentJob.content.waiter}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
