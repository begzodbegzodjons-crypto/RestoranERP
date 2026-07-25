'use client'

import { useState, useEffect, useRef } from 'react'

// ============================================================
// PRINT SERVER v2 - to'liq debug bilan
// ============================================================

export default function PrintServerPage() {
  const [authed, setAuthed] = useState(false)
  const [restaurant, setRestaurant] = useState<any>(null)
  const [stations, setStations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [autoPrint, setAutoPrint] = useState(true)
  const [logs, setLogs] = useState<string[]>([])
  const [stats, setStats] = useState({ printed: 0, failed: 0 })
  const [debugData, setDebugData] = useState<any>(null)
  const iframesRef = useRef<Map<string, HTMLIFrameElement>>(new Map())
  const processingRef = useRef(false)

  const log = (msg: string) => {
    const time = new Date().toLocaleTimeString('uz-UZ')
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 100))
    console.log(`[print-server] ${msg}`)
  }

  // Auth + stations yuklash
  useEffect(() => {
    const init = async () => {
      try {
        log('Auth tekshirilmoqda...')
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        log(`Auth javob: ${JSON.stringify({ authenticated: data.authenticated, restaurant: data.restaurant?.name })}`)

        if (data.authenticated && data.restaurant) {
          setAuthed(true)
          setRestaurant(data.restaurant)
          log(`Restoran: ${data.restaurant.name} (ID: ${data.restaurant.id})`)

          // Printer stansiyalarini yuklash
          log('Printer stansiyalari yuklanmoqda...')
          const pres = await fetch('/api/printers')
          const pdata = await pres.json()
          log(`Stansiyalar: ${pdata.items?.length || 0} ta`)
          if (pdata.items) {
            for (const s of pdata.items) {
              log(`  - ${s.name} (ID: ${s.id}, autoPrint: ${s.autoPrint}, isActive: ${s.isActive})`)
            }
          }
          setStations(pdata.items || [])
        } else {
          log('Avtorizatsiya yo\'q!')
          setAuthed(false)
        }
      } catch (e: any) {
        log(`Init xato: ${e.message}`)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Polling
  useEffect(() => {
    if (!authed || !autoPrint) return

    log('Polling boshlandi (har 2 soniyada)...')

    const poll = async () => {
      if (processingRef.current) return

      try {
        const res = await fetch('/api/print-jobs/auto')
        const data = await res.json()

        if (data.jobs && data.jobs.length > 0) {
          log(`🔔 ${data.jobs.length} ta print job topildi!`)
          setDebugData(data)
          processingRef.current = true

          for (const job of data.jobs) {
            log(`Print qilinmoqda: ${job.printerStation.name} (job: ${job.id})`)
            await processJob(job)
          }

          processingRef.current = false
        }
      } catch (e: any) {
        log(`Polling xato: ${e.message}`)
      }
    }

    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [authed, autoPrint])

  // Job'ni process qilish
  const processJob = async (job: any) => {
    try {
      const content = typeof job.content === 'string' ? JSON.parse(job.content) : job.content
      log(`Content type: ${content.type || 'kitchen'}, items: ${content.items?.length || 0}`)

      const html = buildHTML(content, job.printerStation.name)
      log('HTML generatsiya qilindi, iframe print boshlanmoqda...')

      const success = await printViaIframe(html, job.printerStation.id)
      log(`Print natija: ${success ? 'OK' : 'FAIL'}`)

      if (success) {
        await fetch(`/api/print-jobs/${job.id}/mark-printed`, { method: 'POST' })
        log(`Job ${job.id} -> printed`)
        setStats(prev => ({ ...prev, printed: prev.printed + 1 }))
      } else {
        await fetch(`/api/print-jobs/${job.id}/mark-printed`, { method: 'PUT' })
        log(`Job ${job.id} -> failed`)
        setStats(prev => ({ ...prev, failed: prev.failed + 1 }))
      }
    } catch (e: any) {
      log(`processJob xato: ${e.message}`)
      try {
        await fetch(`/api/print-jobs/${job.id}/mark-printed`, { method: 'PUT' })
      } catch {}
    }
  }

  // Print via iframe
  const printViaIframe = (html: string, stationId: string): Promise<boolean> => {
    return new Promise((resolve) => {
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
        log(`Iframe yaratildi: station ${stationId}`)
      }

      const timeout = setTimeout(() => {
        log('Print timeout (10s)')
        resolve(false)
      }, 10000)

      iframe.onload = () => {
        clearTimeout(timeout)
        try {
          iframe!.contentWindow?.focus()
          iframe!.contentWindow?.print()
          resolve(true)
        } catch (e: any) {
          log(`Print exception: ${e.message}`)
          resolve(false)
        }
      }

      const doc = iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(`<html><head><style>@media print{@page{margin:0;size:80mm auto}body{margin:0;padding:2mm;font-family:monospace;font-size:12px}}body{margin:0;padding:2mm;font-family:monospace;font-size:12px}.c{text-align:center}.r{text-align:right}.b{font-weight:bold}.l{font-size:18px}.xl{font-size:24px}.s{border-top:1px dashed #000;margin:4px 0}</style></head><body>${html}</body></html>`)
        doc.close()
      } else {
        clearTimeout(timeout)
        log('Iframe document topilmadi')
        resolve(false)
      }
    })
  }

  // HTML builder
  const buildHTML = (content: any, stationName: string): string => {
    if (content.type === 'payment') {
      return `<div class="c b l">${content.restaurantName || ''}</div>${content.restaurantPhone ? `<div class="c">Tel: ${content.restaurantPhone}</div>` : ''}<div class="s"></div><div>Chek: ${content.invoiceNo || ''}</div><div>Stol: ${content.table || ''}</div><div>Ofitsiant: ${content.waiter || ''}</div>${content.cashier ? `<div>Kassir: ${content.cashier}</div>` : ''}<div>Vaqt: ${new Date(content.createdAt || Date.now()).toLocaleString('uz-UZ')}</div><div class="s"></div>${(content.items || []).map((it: any) => `<div>${(it.productName || it.name || '').substring(0, 20)} ${it.qty || it.quantity || 1}x = ${((it.total) || (it.price * (it.qty || it.quantity || 1)) || 0).toLocaleString('uz-UZ')}</div>`).join('')}<div class="s"></div><div class="r">Jami: ${(content.subtotal || 0).toLocaleString('uz-UZ')}</div>${content.discount > 0 ? `<div class="r">Chegirma: -${content.discount.toLocaleString('uz-UZ')}</div>` : ''}${content.serviceCharge > 0 ? `<div class="r">Xizmat: +${content.serviceCharge.toLocaleString('uz-UZ')}</div>` : ''}<div class="s"></div><div class="r b l">TO'LOV: ${(content.total || 0).toLocaleString('uz-UZ')}</div><div class="r">${({ cash: 'Naqd', card: 'Karta', transfer: 'O\'tkazma' } as any)[content.paymentMethod] || content.paymentMethod}</div><div class="s"></div><div class="c b l">RAHMAT!</div>`
    }
    return `${content.restaurantName ? `<div class="c b l">${content.restaurantName}</div>` : ''}<div class="c b xl">${stationName}</div><div class="s"></div><div class="b">Buyurtma: ${content.orderNo || ''}</div><div class="b">Stol: ${content.table || ''}</div><div class="b">Ofitsiant: ${content.waiter || ''}</div><div>Vaqt: ${new Date(content.createdAt || Date.now()).toLocaleString('uz-UZ')}</div><div class="s"></div><div class="b">TAOMLAR:</div>${(content.items || []).map((it: any) => `<div class="b l">${it.quantity || it.qty} x ${it.productName || it.name || ''}</div>${it.notes ? `<div style="margin-left:10px;">>> ${it.notes}</div>` : ''}`).join('')}<div class="s"></div><div class="c">${new Date().toLocaleTimeString('uz-UZ')}</div>`
  }

  // Manual test
  const testPrint = async (stationId: string, stationName: string) => {
    log(`Test print: ${stationName}`)
    const html = `<div class="c b xl">TEST</div><div class="s"></div><div>${stationName}</div><div>${new Date().toLocaleString('uz-UZ')}</div><div class="s"></div><div class="c b">✓ TAYYOR</div>`
    await printViaIframe(html, stationId)
  }

  // Manual poll
  const manualPoll = async () => {
    log('Manual poll...')
    try {
      const res = await fetch('/api/print-jobs/auto')
      const data = await res.json()
      log(`Manual poll natija: ${data.jobs?.length || 0} ta job, count: ${data.count}`)
      setDebugData(data)
      if (data.error) log(`API xato: ${data.error}`)
    } catch (e: any) {
      log(`Manual poll xato: ${e.message}`)
    }
  }

  // Test job yaratish - server'da test print job yaratadi
  const createTestJob = async () => {
    log('Test job yaratilmoqda...')
    try {
      const res = await fetch('/api/print-jobs/test-create', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        log(`✅ ${data.count} ta test job yaratildi! (stansiyalar uchun)`)
        // Darhol poll qilish
        setTimeout(() => manualPoll(), 500)
      } else {
        log(`❌ Test job xato: ${data.error}`)
      }
    } catch (e: any) {
      log(`Test job xato: ${e.message}`)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Yuklanmoqda...</div>
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-md text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-white mb-2">Avtorizatsiya kerak</h2>
          <p className="text-slate-400 mb-4">Restoran sifatida tizimga kiring.</p>
          <a href="/" className="inline-block px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold">Bosh sahifa</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">🖨️ Print Server</h1>
              <p className="text-slate-400 text-sm">{restaurant?.name}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={createTestJob} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold">🧪 Test job yaratish</button>
              <button onClick={manualPoll} className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold">🔍 Tekshirish</button>
              <button onClick={() => setAutoPrint(!autoPrint)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${autoPrint ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                {autoPrint ? '⏸ To\'xtatish' : '▶ Yoqish'}
              </button>
            </div>
          </div>
          <div className="mt-2 flex gap-3 text-sm">
            <span className="text-emerald-400">✓ Chop: {stats.printed}</span>
            <span className="text-red-400">✗ Xato: {stats.failed}</span>
            <span className={`px-2 rounded ${autoPrint ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
              {autoPrint ? '● ONLINE' : '○ OFFLINE'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-sm mb-2">📊 Holat</p>
          <div className="text-sm text-slate-300 space-y-1">
            <div>Restoran: {restaurant?.name} (ID: {restaurant?.id?.substring(0, 8)}...)</div>
            <div>Stansiyalar: {stations.length} ta</div>
            <div>Auto-print: {autoPrint ? 'YOQIQ' : 'O\'CHIQ'}</div>
            <div>Iframellar: {iframesRef.current.size} ta</div>
          </div>
        </div>

        {/* Stations */}
        <div className="bg-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-sm mb-3">🖨️ Stansiyalar ({stations.length})</p>
          {stations.length === 0 ? (
            <p className="text-amber-400 text-sm">⚠️ Stansiya yo'q! "Printer sozlamalari" bo'limidan qo'shing.</p>
          ) : (
            <div className="space-y-2">
              {stations.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-slate-700 rounded-xl p-3">
                  <div>
                    <span className="text-white font-medium">{s.name}</span>
                    <span className="text-slate-400 text-xs ml-2">autoPrint: {s.autoPrint ? '✓' : '✗'}</span>
                  </div>
                  <button onClick={() => testPrint(s.id, s.name)} className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium">🧪 Test</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Debug data */}
        {debugData && (
          <div className="bg-slate-800 rounded-2xl p-4">
            <p className="text-slate-400 text-sm mb-2">🔍 So'nggi API javob</p>
            <pre className="bg-slate-900 p-3 rounded text-xs text-slate-300 overflow-x-auto max-h-40 overflow-y-auto">
              {JSON.stringify(debugData, null, 2).substring(0, 2000)}
            </pre>
          </div>
        )}

        {/* Log */}
        <div className="bg-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm">📋 Log ({logs.length})</p>
            <button onClick={() => setLogs([])} className="text-slate-500 text-xs">Tozalash</button>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 max-h-96 overflow-y-auto space-y-0.5">
            {logs.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-4">Log yo'q</p>
            ) : (
              logs.map((l, i) => (
                <div key={i} className="text-xs font-mono text-slate-400">{l}</div>
              ))
            )}
          </div>
        </div>

        {/* Help */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4">
          <p className="text-blue-100 text-sm font-semibold mb-2">📋 Ko'rsatma:</p>
          <ol className="list-decimal list-inside text-blue-200 text-sm space-y-1">
            <li>"🧪 Test job yaratish" tugmasini bosing — server test job yaratadi</li>
            <li>Log'da "X ta test job yaratildi" va "X ta job topildi" ko'rinadi</li>
            <li>Chrome print oynasi ochiladi — printerni tanlang</li>
            <li>"Save" tugmasini bosing (Chrome eslab qoladi)</li>
            <li>Ofitsiant buyurtma berganda avtomatik print bo'ladi</li>
          </ol>
          <p className="text-blue-300 text-xs mt-2">
            Agar "0 ta job" chiqsa — print job yaratilmayapti, "Test job yaratish" bilan tekshiring.
          </p>
        </div>

        {/* Kiosk mode */}
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl p-4">
          <p className="text-emerald-100 text-sm font-semibold mb-2">🚀 100% AVTOMATIK PRINT (Chrome Kiosk):</p>
          <p className="text-emerald-200 text-sm mb-2">
            Print dialog chiqmasdan avtomatik print uchun:
          </p>
          <ol className="list-decimal list-inside text-emerald-200 text-sm space-y-1">
            <li>Chrome'ni yoping</li>
            <li>Windows'da Win+R bosing, quyidagini yozing:</li>
          </ol>
          <pre className="bg-slate-900 p-2 rounded text-xs text-emerald-300 mt-2 overflow-x-auto">
            chrome.exe --kiosk-printing "https://restoran-erp.begzodbegzodjons.workers.dev/print-server"
          </pre>
          <p className="text-emerald-300 text-xs mt-2">
            Bu rejimda Chrome print dialog'ni o'chiryapti — avtomatik print qiladi!
          </p>
        </div>
      </div>
    </div>
  )
}
