'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { api, toast } from './utils'

type PrintJob = {
  id: string
  content: any
  printerStation: { id: string; name: string }
  createdAt: string
}

type PrinterStation = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  autoPrint: boolean
}

// ============================================================
// BRAUZER PRINT - 100% ishlaydi (WebUSB emas)
// ============================================================
// Chrome print oynasi ochiladi, foydalanuvchi printerni tanlaydi
// Chrome tanlovni eslab qoladi - keyingi print'larda avtomatik

function printReceipt(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        resolve(true)
      } catch {
        resolve(false)
      }
      // Cleanup after 3 seconds
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 3000)
    }

    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(`
        <html>
        <head>
          <style>
            @media print {
              body { margin: 0; padding: 0; font-family: monospace; }
              .receipt { width: 80mm; padding: 2mm; font-size: 12px; }
              .center { text-align: center; }
              .right { text-align: right; }
              .bold { font-weight: bold; }
              .large { font-size: 18px; }
              .xlarge { font-size: 24px; }
              .sep { border-top: 1px dashed #000; margin: 4px 0; }
              .item { margin: 2px 0; }
              @page { margin: 0; size: 80mm auto; }
            }
            body { margin: 0; padding: 0; font-family: monospace; }
            .receipt { width: 80mm; padding: 2mm; font-size: 12px; }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .large { font-size: 18px; }
            .xlarge { font-size: 24px; }
            .sep { border-top: 1px dashed #000; margin: 4px 0; }
            .item { margin: 2px 0; }
          </style>
        </head>
        <body>
          <div class="receipt">${html}</div>
        </body>
        </html>
      `)
      doc.close()
    }
  })
}

function buildKitchenHTML(content: any, stationName: string): string {
  let html = ''
  if (content.restaurantName) {
    html += `<div class="center bold large">${content.restaurantName}</div>`
  }
  html += `<div class="center bold xlarge">${stationName}</div>`
  html += `<div class="sep"></div>`
  html += `<div class="bold">Buyurtma: ${content.orderNo || ''}</div>`
  html += `<div class="bold">Stol: ${content.table || ''}</div>`
  html += `<div class="bold">Ofitsiant: ${content.waiter || ''}</div>`
  html += `<div>Vaqt: ${new Date(content.createdAt || Date.now()).toLocaleString('uz-UZ')}</div>`
  html += `<div class="sep"></div>`
  html += `<div class="bold">TAOMLAR:</div>`
  for (const item of (content.items || [])) {
    html += `<div class="item bold large">${item.quantity} x ${item.productName || item.name || ''}</div>`
    if (item.notes) {
      html += `<div style="margin-left:10px;">>> ${item.notes}</div>`
    }
  }
  html += `<div class="sep"></div>`
  html += `<div class="center">${new Date().toLocaleTimeString('uz-UZ')}</div>`
  return html
}

function buildPaymentHTML(content: any): string {
  let html = ''
  html += `<div class="center bold large">${content.restaurantName || ''}</div>`
  if (content.restaurantPhone) {
    html += `<div class="center">Tel: ${content.restaurantPhone}</div>`
  }
  html += `<div class="sep"></div>`
  html += `<div>Chek: ${content.invoiceNo || ''}</div>`
  html += `<div>Stol: ${content.table || ''}</div>`
  html += `<div>Ofitsiant: ${content.waiter || ''}</div>`
  if (content.cashier) html += `<div>Kassir: ${content.cashier}</div>`
  html += `<div>Vaqt: ${new Date(content.createdAt || Date.now()).toLocaleString('uz-UZ')}</div>`
  html += `<div class="sep"></div>`
  for (const item of (content.items || [])) {
    const name = (item.productName || item.name || '').substring(0, 20)
    const qty = item.quantity || item.qty || 1
    const total = item.total || (item.price ? item.price * qty : 0)
    html += `<div class="item">${name} ${qty}x = ${total.toLocaleString('uz-UZ')}</div>`
  }
  html += `<div class="sep"></div>`
  html += `<div class="right">Jami: ${(content.subtotal || 0).toLocaleString('uz-UZ')}</div>`
  if (content.discount > 0) html += `<div class="right">Chegirma: -${content.discount.toLocaleString('uz-UZ')}</div>`
  if (content.serviceCharge > 0) html += `<div class="right">Xizmat: +${content.serviceCharge.toLocaleString('uz-UZ')}</div>`
  if (content.taxAmount > 0) html += `<div class="right">QQS: +${content.taxAmount.toLocaleString('uz-UZ')}</div>`
  html += `<div class="sep"></div>`
  html += `<div class="right bold large">TO'LOV: ${(content.total || 0).toLocaleString('uz-UZ')}</div>`
  const methods: Record<string, string> = { cash: 'Naqd', card: 'Karta', transfer: 'O\'tkazma' }
  html += `<div class="right">${methods[content.paymentMethod] || content.paymentMethod || ''}</div>`
  html += `<div class="sep"></div>`
  html += `<div class="center bold large">RAHMAT!</div>`
  html += `<div class="center">Yangi kelishingizni kutamiz</div>`
  return html
}

function buildTestHTML(stationName: string): string {
  return `
    <div class="center bold xlarge">TEST CHEK</div>
    <div class="sep"></div>
    <div>Printer: ${stationName}</div>
    <div>Vaqt: ${new Date().toLocaleString('uz-UZ')}</div>
    <div class="sep"></div>
    <div>Oddiy matn</div>
    <div class="bold">Qalin matn</div>
    <div class="large">Katta matn</div>
    <div class="center">Markazda</div>
    <div class="right">O'ngda</div>
    <div class="sep"></div>
    <div class="center bold">✓ PRINTER ISHLAYAPTI</div>
    <div class="center">Chek chop etish tayyor</div>
  `
}

// ============================================================
// COMPONENT
// ============================================================
export default function PosPrintMonitor() {
  const [stations, setStations] = useState<PrinterStation[]>([])
  const [loading, setLoading] = useState(true)
  const [autoPrint, setAutoPrint] = useState(true)
  const [jobQueue, setJobQueue] = useState<PrintJob[]>([])
  const [printLog, setPrintLog] = useState<Array<{ id: string; station: string; time: string; status: 'ok' | 'fail'; msg?: string }>>([])
  const [processing, setProcessing] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({})
  const autoPrintRef = useRef(autoPrint)
  const lastPollRef = useRef<number>(0)

  useEffect(() => { autoPrintRef.current = autoPrint }, [autoPrint])

  const loadStations = useCallback(async () => {
    try {
      const res = await api('/api/printers')
      setStations(res.items || [])
    } catch (e) {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStations() }, [loadStations])

  // Print job'larni poll qilish
  const pollJobs = useCallback(async () => {
    if (!autoPrintRef.current || processing) return
    const now = Date.now()
    if (now - lastPollRef.current < 3000) return
    lastPollRef.current = now

    try {
      const res = await api('/api/print-jobs/auto')
      if (res.jobs && res.jobs.length > 0) {
        setJobQueue(prev => [...prev, ...res.jobs])
      }
    } catch (e) {
      // silent
    }
  }, [processing])

  useEffect(() => {
    const interval = setInterval(pollJobs, 3000)
    return () => clearInterval(interval)
  }, [pollJobs])

  // Job queue process
  useEffect(() => {
    if (jobQueue.length === 0 || processing) return

    const run = async () => {
      setProcessing(true)
      const job = jobQueue[0]

      try {
        const content = job.content
        const html = content.type === 'payment'
          ? buildPaymentHTML(content)
          : buildKitchenHTML(content, job.printerStation.name)

        const success = await printReceipt(html)

        if (success) {
          await api(`/api/print-jobs/${job.id}/mark-printed`, { method: 'POST' })
          setPrintLog(prev => [{
            id: job.id,
            station: job.printerStation.name,
            time: new Date().toLocaleTimeString('uz-UZ'),
            status: 'ok'
          }, ...prev].slice(0, 30))
        } else {
          await api(`/api/print-jobs/${job.id}/mark-printed`, { method: 'PUT' })
          setPrintLog(prev => [{
            id: job.id,
            station: job.printerStation.name,
            time: new Date().toLocaleTimeString('uz-UZ'),
            status: 'fail',
            msg: 'Print oynasi ochilmadi'
          }, ...prev].slice(0, 30))
        }
      } catch (e: any) {
        setPrintLog(prev => [{
          id: job.id,
          station: job.printerStation.name,
          time: new Date().toLocaleTimeString('uz-UZ'),
          status: 'fail',
          msg: e.message
        }, ...prev].slice(0, 30))
      } finally {
        setJobQueue(prev => prev.slice(1))
        setProcessing(false)
      }
    }
    run()
  }, [jobQueue, processing])

  // Test print
  const handleTestPrint = useCallback(async (stationId: string, stationName: string) => {
    setTestResults(prev => ({ ...prev, [stationId]: 'testing' }))
    try {
      const html = buildTestHTML(stationName)
      const success = await printReceipt(html)
      if (success) {
        setTestResults(prev => ({ ...prev, [stationId]: 'ok' }))
        toast.success(`✓ ${stationName} — Chrome print oynasi ochildi!`)
        setPrintLog(prev => [{
          id: `test_${Date.now()}`,
          station: stationName,
          time: new Date().toLocaleTimeString('uz-UZ'),
          status: 'ok',
          msg: 'Test print'
        }, ...prev].slice(0, 30))
      } else {
        setTestResults(prev => ({ ...prev, [stationId]: 'fail' }))
        toast.error(`${stationName} — print oynasi ochilmadi`)
      }
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [stationId]: 'fail' }))
      toast.error(`Xato: ${e.message}`)
    }
  }, [])

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        <p className="mt-2 text-slate-400">Yuklanmoqda...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🖨️ POS Print Monitor</h2>
          <p className="text-slate-500 text-sm mt-1">
            Chrome print oynasi orqali chek chiqarish
          </p>
        </div>
        <button
          onClick={() => setAutoPrint(!autoPrint)}
          className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
            autoPrint
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          {autoPrint ? '✓ Avtomatik print YONIQ' : '✗ Avtomatik print O\'CHIQ'}
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Qanday ishlaydi:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-800">
              <li>Avval <strong>"⚙️ Boshqaruv" → "🖨️ Printer sozlamalari"</strong> — 4 ta stansiya qo'shing</li>
              <li>Keyin <strong>"🍽️ Mahsulotlar" → "🏷️ Kategoriyalar"</strong> — har bir kategoriyani printerga bog'lang</li>
              <li>Bu yerga qaytib, har bir stansiyada <strong>"🧪 Test"</strong> tugmasini bosing</li>
              <li>Chrome print oynasi ochiladi — printerni tanlang va "Print" ni bosing</li>
              <li>Chrome tanlovni eslab qoladi — keyingi print'larda avtomatik</li>
              <li>Avtomatik print yoniq bo'lsa — ofitsiant buyurtma berganda avtomatik print oynasi ochiladi</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Printer stations */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-3">🖨️ Printer stansiyalari</h3>
        {stations.length === 0 ? (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-3">🖨️</div>
            <h3 className="text-lg font-bold text-amber-900 mb-2">Printer stansiyalari yo'q!</h3>
            <div className="bg-white rounded-xl p-4 text-left max-w-md mx-auto">
              <p className="font-semibold text-slate-900 mb-2">📋 Bosqichma-bosqich:</p>
              <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1.5">
                <li>Chap menyudan <strong>"⚙️ Boshqaruv" → "🖨️ Printer sozlamalari"</strong></li>
                <li><strong>"+ Yangi stansiya"</strong> tugmasini bosing</li>
                <li>Stansiya nomi: <code className="bg-slate-100 px-1 rounded">Shashlik printer</code></li>
                <li><strong>Printer IP maydonini BO'SH qoldiring</strong></li>
                <li><strong>"Avtomatik print"</strong> ni yoqing ⚡</li>
                <li>Saqlash</li>
                <li>4 ta stansiya: Shashlik, Oshpaz, Muzqaymoq, Kassa</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stations.map(station => {
              const testStatus = testResults[station.id] || 'idle'
              return (
                <div key={station.id} className="bg-white rounded-2xl border-2 border-slate-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold text-slate-900 text-lg">{station.name}</div>
                      {station.description && (
                        <div className="text-xs text-slate-500 mt-0.5">{station.description}</div>
                      )}
                      {station.autoPrint && (
                        <div className="text-xs text-emerald-600 mt-0.5">⚡ Avtomatik print yoqilgan</div>
                      )}
                    </div>
                  </div>

                  {/* Test result */}
                  {testStatus !== 'idle' && (
                    <div className={`text-xs font-semibold mb-2 px-2 py-1 rounded ${
                      testStatus === 'testing' ? 'bg-blue-50 text-blue-700' :
                      testStatus === 'ok' ? 'bg-emerald-50 text-emerald-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {testStatus === 'testing' && '⏳ Print oynasi ochilmoqda...'}
                      {testStatus === 'ok' && '✓ Print oynasi ochildi - printerni tanlang!'}
                      {testStatus === 'fail' && '✗ Print oynasi ochilmadi'}
                    </div>
                  )}

                  {/* Test button */}
                  <button
                    onClick={() => handleTestPrint(station.id, station.name)}
                    disabled={testStatus === 'testing'}
                    className="w-full py-2 rounded-lg bg-blue-50 text-blue-700 font-semibold text-sm hover:bg-blue-100 disabled:opacity-50"
                  >
                    {testStatus === 'testing' ? '⏳...' : '🧪 Test chek chiqarish'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Print queue */}
      {jobQueue.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-amber-500 rounded-full border-t-transparent"></div>
            <span className="font-semibold text-amber-900">
              Navbatda: {jobQueue.length} ta print job
            </span>
          </div>
        </div>
      )}

      {/* Print log */}
      {printLog.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-3">📋 Print tarixi</h3>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden max-h-80 overflow-y-auto">
            {printLog.map((log, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${log.status === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {log.status === 'ok' ? '✓' : '✗'}
                  </span>
                  <div>
                    <div className="font-medium text-slate-900 text-sm">{log.station}</div>
                    <div className="text-xs text-slate-400">
                      {log.time}{log.msg ? ` • ${log.msg}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
