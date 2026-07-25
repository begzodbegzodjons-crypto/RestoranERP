'use client'

import { useState, useEffect, useRef } from 'react'
import { api } from './utils'

// ============================================================
// PRINT SERVER - kassir kompyuterida alohida oynada ochiladi
// ============================================================
// Bu sahifa POS monoblokda Chrome'da alohida tab'da ochiq turadi.
// Har 2 soniyada server'dan print job'larni oladi va
// avtomatik print qiladi (Chrome "silent print" orqali).
//
// Foydalanish:
// 1. Kassir kompyuterida Chrome'ni oching
// 2. Dasturga kiring (restoran egasi sifatida)
// 3. URL'ga /print-server qo'shing: https://...workers.dev/print-server
// 4. Bu sahifa ochiq qolsin
// 5. Ofitsiant buyurtma berganda → avtomatik print
//
// PRINTERNI TANLASH:
// 1. Birinchi print'da Chrome print dialog ochiladi
// 2. Printerni tanlang
// 3. "Birlamchi printer sifatida saqlash" ni belgilang (✓)
// 4. "Print" ni bosing
// 5. Keyingi print'larda avtomatik shu printerga yuboriladi
//
// 4 ta printer uchun:
// - Print Server sahifasida 4 ta printer config qilinadi
// - Har bir station uchun alohida iframe ochiladi
// - Har bir iframe o'z printerini eslab qoladi

type PrintJob = {
  id: string
  content: any
  printerStation: { id: string; name: string }
  createdAt: string
}

type StationConfig = {
  stationId: string
  stationName: string
  printerName: string  // Chrome'ga saqlangan printer nomi
  iframe: HTMLIFrameElement | null
  ready: boolean
}

export default function PrintServerPage() {
  const [stations, setStations] = useState<StationConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [autoPrint, setAutoPrint] = useState(true)
  const [logs, setLogs] = useState<Array<{ time: string; station: string; status: 'ok' | 'fail' | 'pending'; msg?: string }>>([])
  const [stats, setStats] = useState({ printed: 0, failed: 0, pending: 0 })
  const [lastPoll, setLastPoll] = useState<Date | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const iframesRef = useRef<Map<string, HTMLIFrameElement>>(new Map())
  const processingRef = useRef(false)

  // Login holatini tekshirish
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api('/api/auth/me')
        if (res.authenticated && res.restaurant) {
          setRestaurantId(res.restaurant.id)
          // Printer stansiyalarini yuklash
          const printersRes = await api('/api/printers')
          const stationConfigs: StationConfig[] = (printersRes.items || []).map((s: any) => ({
            stationId: s.id,
            stationName: s.name,
            printerName: '',
            iframe: null,
            ready: false,
          }))
          setStations(stationConfigs)
        } else {
          setRestaurantId(null)
        }
      } catch (e) {
        setRestaurantId(null)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  // Print job'larni poll qilish
  useEffect(() => {
    if (!restaurantId || !autoPrint) return

    const poll = async () => {
      if (processingRef.current) return

      try {
        const res = await api('/api/print-jobs/auto')
        setLastPoll(new Date())

        if (res.jobs && res.jobs.length > 0) {
          processingRef.current = true

          for (const job of res.jobs) {
            await processJob(job)
          }

          processingRef.current = false
        }
      } catch (e) {
        // silent
      }
    }

    const interval = setInterval(poll, 2000)
    poll() // darhol birinchi poll
    return () => clearInterval(interval)
  }, [restaurantId, autoPrint])

  // Job'ni process qilish
  const processJob = async (job: PrintJob) => {
    const station = stations.find(s => s.stationId === job.printerStation.id)
    if (!station) {
      addLog(job.printerStation.name, 'fail', 'Stansiya topilmadi')
      try { await api(`/api/print-jobs/${job.id}/mark-printed`, { method: 'PUT' }) } catch {}
      return
    }

    try {
      const content = typeof job.content === 'string' ? JSON.parse(job.content) : job.content
      const html = buildReceiptHTML(content, job.printerStation.name)

      // iframe orqali print — Chrome eslab qoladi
      const success = await printViaIframe(html, station.stationId)

      if (success) {
        await api(`/api/print-jobs/${job.id}/mark-printed`, { method: 'POST' })
        addLog(job.printerStation.name, 'ok')
        setStats(prev => ({ ...prev, printed: prev.printed + 1 }))
      } else {
        await api(`/api/print-jobs/${job.id}/mark-printed`, { method: 'PUT' })
        addLog(job.printerStation.name, 'fail', 'Print xatosi')
        setStats(prev => ({ ...prev, failed: prev.failed + 1 }))
      }
    } catch (e: any) {
      addLog(job.printerStation.name, 'fail', e.message)
      try { await api(`/api/print-jobs/${job.id}/mark-printed`, { method: 'PUT' }) } catch {}
      setStats(prev => ({ ...prev, failed: prev.failed + 1 }))
    }
  }

  // iframe orqali print
  const printViaIframe = (html: string, stationId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // Har bir station uchun alohida iframe (Chrome har biri uchun printer eslaydi)
      let iframe = iframesRef.current.get(stationId)
      if (!iframe) {
        iframe = document.createElement('iframe')
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = 'none'
        document.body.appendChild(iframe)
        iframesRef.current.set(stationId, iframe)
      }

      const timeout = setTimeout(() => {
        resolve(false)
      }, 10000) // 10s timeout

      iframe.onload = () => {
        clearTimeout(timeout)
        try {
          iframe!.contentWindow?.focus()
          iframe!.contentWindow?.print()
          resolve(true)
        } catch {
          resolve(false)
        }
      }

      const doc = iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(`<html><head><style>
          @media print {
            @page { margin: 0; size: 80mm auto; }
            body { margin: 0; padding: 2mm; font-family: 'Courier New', monospace; font-size: 12px; }
          }
          body { margin: 0; padding: 2mm; font-family: 'Courier New', monospace; font-size: 12px; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .large { font-size: 18px; }
          .xlarge { font-size: 24px; }
          .sep { border-top: 1px dashed #000; margin: 4px 0; }
        </style></head><body>${html}</body></html>`)
        doc.close()
      } else {
        clearTimeout(timeout)
        resolve(false)
      }
    })
  }

  // Receipt HTML
  const buildReceiptHTML = (content: any, stationName: string): string => {
    if (content.type === 'payment') {
      return `
        <div class="center bold large">${content.restaurantName || ''}</div>
        ${content.restaurantPhone ? `<div class="center">Tel: ${content.restaurantPhone}</div>` : ''}
        <div class="sep"></div>
        <div>Chek: ${content.invoiceNo || ''}</div>
        <div>Stol: ${content.table || ''}</div>
        <div>Ofitsiant: ${content.waiter || ''}</div>
        ${content.cashier ? `<div>Kassir: ${content.cashier}</div>` : ''}
        <div>Vaqt: ${new Date(content.createdAt || Date.now()).toLocaleString('uz-UZ')}</div>
        <div class="sep"></div>
        ${(content.items || []).map((it: any) => `<div>${(it.productName || it.name || '').substring(0, 20)} ${it.qty || it.quantity || 1}x = ${((it.total) || (it.price * (it.qty || it.quantity || 1)) || 0).toLocaleString('uz-UZ')}</div>`).join('')}
        <div class="sep"></div>
        <div class="right">Jami: ${(content.subtotal || 0).toLocaleString('uz-UZ')}</div>
        ${content.discount > 0 ? `<div class="right">Chegirma: -${content.discount.toLocaleString('uz-UZ')}</div>` : ''}
        ${content.serviceCharge > 0 ? `<div class="right">Xizmat: +${content.serviceCharge.toLocaleString('uz-UZ')}</div>` : ''}
        <div class="sep"></div>
        <div class="right bold large">TO'LOV: ${(content.total || 0).toLocaleString('uz-UZ')}</div>
        <div class="right">${({ cash: 'Naqd', card: 'Karta', transfer: 'O\'tkazma' } as any)[content.paymentMethod] || content.paymentMethod}</div>
        <div class="sep"></div>
        <div class="center bold large">RAHMAT!</div>
      `
    } else {
      return `
        ${content.restaurantName ? `<div class="center bold large">${content.restaurantName}</div>` : ''}
        <div class="center bold xlarge">${stationName}</div>
        <div class="sep"></div>
        <div class="bold">Buyurtma: ${content.orderNo || ''}</div>
        <div class="bold">Stol: ${content.table || ''}</div>
        <div class="bold">Ofitsiant: ${content.waiter || ''}</div>
        <div>Vaqt: ${new Date(content.createdAt || Date.now()).toLocaleString('uz-UZ')}</div>
        <div class="sep"></div>
        <div class="bold">TAOMLAR:</div>
        ${(content.items || []).map((it: any) => `<div class="bold large">${it.quantity || it.qty} x ${it.productName || it.name || ''}</div>${it.notes ? `<div style="margin-left:10px;">>> ${it.notes}</div>` : ''}`).join('')}
        <div class="sep"></div>
        <div class="center">${new Date().toLocaleTimeString('uz-UZ')}</div>
      `
    }
  }

  // Test print
  const testPrint = async (stationId: string, stationName: string) => {
    const html = `
      <div class="center bold xlarge">TEST CHEK</div>
      <div class="sep"></div>
      <div>Printer: ${stationName}</div>
      <div>Vaqt: ${new Date().toLocaleString('uz-UZ')}</div>
      <div class="sep"></div>
      <div class="center bold large">✓ PRINTER TAYYOR</div>
      <div class="center">Chek chop etish ishlayapti</div>
    `
    const success = await printViaIframe(html, stationId)
    if (success) {
      addLog(stationName, 'ok', 'Test print')
    } else {
      addLog(stationName, 'fail', 'Test xatosi')
    }
  }

  const addLog = (station: string, status: 'ok' | 'fail' | 'pending', msg?: string) => {
    setLogs(prev => [{
      time: new Date().toLocaleTimeString('uz-UZ'),
      station,
      status,
      msg,
    }, ...prev].slice(0, 50))
  }

  // === RENDER ===

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          <p className="mt-3 text-slate-400">Print Server yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  if (!restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-md text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-white mb-2">Avtorizatsiya kerak</h2>
          <p className="text-slate-400 mb-4">
            Print Server ishlashi uchun avval restoran sifatida tizimga kiring.
          </p>
          <a href="/" className="inline-block px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold">
            Bosh sahifaga o'tish
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                🖨️ Print Server
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Bu sahifa ochiq tursin — avtomatik print ishlaydi
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                autoPrint ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {autoPrint ? '● ONLINE' : '○ OFFLINE'}
              </div>
              <button
                onClick={() => setAutoPrint(!autoPrint)}
                className={`px-4 py-2 rounded-xl font-semibold text-sm ${
                  autoPrint ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                }`}
              >
                {autoPrint ? 'To\'xtatish' : 'Yoqish'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-emerald-400">{stats.printed}</div>
            <div className="text-xs text-slate-400 mt-1">Chop etilgan</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-400">{stats.failed}</div>
            <div className="text-xs text-slate-400 mt-1">Xato</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-400">{stats.pending}</div>
            <div className="text-xs text-slate-400 mt-1">Navbatda</div>
          </div>
        </div>

        {/* Last poll */}
        {lastPoll && (
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <span className="text-slate-400 text-sm">
              So'nggi tekshiruv: {lastPoll.toLocaleTimeString('uz-UZ')}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div className="text-sm text-blue-100">
              <p className="font-semibold mb-1">Birinchi marta print qilish:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-200">
                <li>Quyidagi "🧪 Test" tugmasini bosing</li>
                <li>Chrome print oynasi ochiladi</li>
                <li>Printerni tanlang</li>
                <li><strong>"Destination" maydonida printerni tanlang</strong></li>
                <li><strong>"Save" tugmasini bosing</strong> (Chrome eslab qoladi)</li>
                <li>Keyingi print'larda avtomatik shu printerga yuboriladi</li>
              </ol>
              <p className="mt-2 text-blue-300">
                Har bir printer uchun bittadan test qiling (4 ta).
              </p>
            </div>
          </div>
        </div>

        {/* Printer stations */}
        <div>
          <h3 className="text-lg font-bold text-white mb-3">🖨️ Printer stansiyalari</h3>
          {stations.length === 0 ? (
            <div className="bg-amber-900/30 border border-amber-700 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <p className="text-amber-200 font-semibold">Printer stansiyalari yo'q!</p>
              <p className="text-amber-300 text-sm mt-1">
                "Printer sozlamalari" bo'limidan 4 ta stansiya qo'shing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stations.map(station => (
                <div key={station.stationId} className="bg-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-white">{station.stationName}</div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                      Tayyor
                    </span>
                  </div>
                  <button
                    onClick={() => testPrint(station.stationId, station.stationName)}
                    className="w-full py-2 rounded-lg bg-blue-500/20 text-blue-400 font-semibold text-sm hover:bg-blue-500/30"
                  >
                    🧪 Test chek
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Log */}
        {logs.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-white mb-3">📋 Print log</h3>
            <div className="bg-slate-800 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700 last:border-0">
                  <span className={`text-lg ${
                    log.status === 'ok' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {log.status === 'ok' ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <span className="text-white text-sm font-medium">{log.station}</span>
                    {log.msg && <span className="text-slate-500 text-xs ml-2">{log.msg}</span>}
                  </div>
                  <span className="text-slate-500 text-xs">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 text-center">
          <p className="text-amber-200 text-sm">
            ⚠️ Bu sahifani <strong>yopmang</strong> — print server shu yerda ishlaydi.
            Kassir panelini alohida tab'da oching.
          </p>
        </div>
      </div>
    </div>
  )
}
