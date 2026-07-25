'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { api, toast } from './utils'
import { useUsbPrinters } from '@/lib/useUsbPrinters'
import { buildKitchenReceipt, buildPaymentReceipt, buildTestReceipt } from '@/lib/escpos'

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

export default function PosPrintMonitor() {
  // === HOOK'LAR (eng yuqorida) ===
  const {
    mapping, connected, supported, error,
    connectPrinter, disconnectPrinter, print, testPrint
  } = useUsbPrinters()

  const [stations, setStations] = useState<PrinterStation[]>([])
  const [loading, setLoading] = useState(true)
  const [autoPrint, setAutoPrint] = useState(true)
  const [jobQueue, setJobQueue] = useState<PrintJob[]>([])
  const [printLog, setPrintLog] = useState<Array<{ id: string; station: string; time: string; status: 'ok' | 'fail'; msg?: string }>>([])
  const [processing, setProcessing] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'fail'>>({})
  const autoPrintRef = useRef(autoPrint)
  const lastPollRef = useRef<number>(0)

  useEffect(() => { autoPrintRef.current = autoPrint }, [autoPrint])

  // Printer stansiyalarini yuklash
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

  // Print job'larni poll qilish - har 3 soniyada
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

  // Bitta print job'ni ishlash
  const processJob = useCallback(async (job: PrintJob) => {
    const stationId = job.printerStation.id
    const isConnected = connected.has(stationId)

    if (!isConnected) {
      setPrintLog(prev => [{
        id: job.id,
        station: job.printerStation.name,
        time: new Date().toLocaleTimeString('uz-UZ'),
        status: 'fail',
        msg: 'Printer ulanmagan'
      }, ...prev].slice(0, 30))
      // Job'ni o'chirib tashlash (qayta urinmaslik)
      try {
        await api(`/api/print-jobs/${job.id}/mark-printed`, { method: 'PUT' })
      } catch {}
      return
    }

    try {
      const content = job.content
      let escposData: Uint8Array

      if (content.type === 'payment') {
        escposData = buildPaymentReceipt({
          invoiceNo: content.invoiceNo || '',
          table: content.table || '',
          waiter: content.waiter || '',
          cashier: content.cashier || '',
          createdAt: content.createdAt || new Date().toISOString(),
          items: content.items || [],
          subtotal: content.subtotal || 0,
          discount: content.discount || 0,
          serviceCharge: content.serviceCharge || 0,
          taxAmount: content.taxAmount || 0,
          total: content.total || 0,
          paymentMethod: content.paymentMethod || 'cash',
          restaurantName: content.restaurantName || '',
          restaurantPhone: content.restaurantPhone,
        })
      } else {
        escposData = buildKitchenReceipt({
          orderNo: content.orderNo || '',
          table: content.table || '',
          waiter: content.waiter || '',
          createdAt: content.createdAt || new Date().toISOString(),
          items: content.items || [],
          printerStationName: job.printerStation.name,
          restaurantName: content.restaurantName,
        })
      }

      const success = await print(stationId, escposData)

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
          msg: 'USB transfer xatosi'
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
    }
  }, [connected, print])

  // Job queue ni process qilish
  useEffect(() => {
    if (jobQueue.length === 0 || processing) return

    const run = async () => {
      setProcessing(true)
      const job = jobQueue[0]
      await processJob(job)
      setJobQueue(prev => prev.slice(1))
      setProcessing(false)
    }
    run()
  }, [jobQueue, processing, processJob])

  // Test print - alohida funksiya, aniq natija ko'rsatadi
  const handleTestPrint = useCallback(async (stationId: string, stationName: string) => {
    setTestResults(prev => ({ ...prev, [stationId]: 'testing' }))

    try {
      const data = buildTestReceipt(stationName)
      const success = await testPrint(stationId, data)

      if (success) {
        setTestResults(prev => ({ ...prev, [stationId]: 'ok' }))
        toast.success(`✓ ${stationName} — chek chiqdi!`)
        setPrintLog(prev => [{
          id: `test_${Date.now()}`,
          station: stationName,
          time: new Date().toLocaleTimeString('uz-UZ'),
          status: 'ok',
          msg: 'Test print'
        }, ...prev].slice(0, 30))
      } else {
        setTestResults(prev => ({ ...prev, [stationId]: 'fail' }))
        toast.error(`${stationName} — chek chiqmadi`)
        setPrintLog(prev => [{
          id: `test_${Date.now()}`,
          station: stationName,
          time: new Date().toLocaleTimeString('uz-UZ'),
          status: 'fail',
          msg: 'Test print xatosi'
        }, ...prev].slice(0, 30))
      }
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [stationId]: 'fail' }))
      toast.error(`Xato: ${e.message}`)
    }
  }, [testPrint])

  // USB device ma'lumotlari (debug)
  const showDebugInfo = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.usb) {
      setDebugInfo('WebUSB qo\'llab-quvvatlanmaydi (Chrome/Edge kerak)')
      return
    }
    try {
      const devices = await navigator.usb.getDevices()
      if (devices.length === 0) {
        setDebugInfo(`Chrome'da hech qanday USB device topilmadi.

Avval "USB ulash" tugmasi bilan printerni tanlang.
Tanlaganidan keyin shu yerda ko'rinadi.

Eslatma: Chrome USB'ga ruxsat bergan device'larni eslab qoladi.`)
        return
      }
      const info = devices.map((d, i) => {
        const cfgs = d.configurations.map((c, ci) => {
          const ifaces = c.interfaces.map(iface =>
            `iface#${iface.interfaceNumber}(${iface.alternate?.endpoints?.length || 0} eps)`
          ).join(', ')
          return `  config#${ci} (${c.interfaces.length} ifaces): ${ifaces}`
        }).join('\n')
        return `Device ${i + 1}:
  VID: 0x${d.vendorId.toString(16).padStart(4, '0')}
  PID: 0x${d.productId.toString(16).padStart(4, '0')}
  Name: ${d.productName || '(noma\'lum)'}
  Manufacturer: ${d.manufacturerName || '(noma\'lum)'}
  Serial: ${d.serialNumber || '-'}
  Opened: ${d.opened ? 'ha' : 'yo\'q'}
${cfgs}`
      }).join('\n\n---\n\n')
      setDebugInfo(info)
    } catch (e: any) {
      setDebugInfo('Xato: ' + e.message)
    }
  }, [])

  // === EARLY RETURNS (hook'lardan keyin) ===

  if (!supported) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-red-900 mb-2">WebUSB qo'llab-quvvatlanmaydi</h2>
          <p className="text-red-700 text-sm mb-4">
            USB printer'ga ulanish uchun <strong>Chrome</strong> yoki <strong>Edge</strong> brauzer kerak.
            Firefox va Safari WebUSB'ni qo'llamaydi.
          </p>
          <div className="bg-white rounded-xl p-4 text-left text-sm">
            <p className="font-semibold text-slate-900 mb-2">Yechim:</p>
            <ol className="list-decimal list-inside text-slate-600 space-y-1">
              <li>Chrome brauzerda dasturni oching</li>
              <li>"POS Print Monitor" bo'limiga kiring</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

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
            USB printerlarni ulang va avtomatik print'ni yoqing
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

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">❌</span>
            <div className="flex-1 text-sm text-red-900">
              <p className="font-semibold mb-1">Ulanish xatosi:</p>
              <p className="text-red-700 font-mono text-xs bg-white p-2 rounded break-all">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Qanday ishlaydi:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-800">
              <li>Avval <strong>"Printer sozlamalari"</strong> bo'limidan 4 ta stansiya qo'shing (Shashlik, Oshpaz, Muzqaymoq, Kassa)</li>
              <li>Keyin <strong>"Kategoriyalar"</strong> bo'limidan har bir kategoriyani printerga bog'lang</li>
              <li>Bu yerga qaytib, har bir stansiyaga "USB ulash" tugmasi bilan printerni tanlang</li>
              <li>"Test" tugmasi bilan tekshiring — chek chiqishi kerak</li>
              <li>Avtomatik print yoniq bo'lsa — ofitsiant buyurtma berganda avtomatik chop etadi</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Debug info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-slate-900 text-sm">🔧 USB device ma'lumotlari (debug)</p>
          <button
            onClick={showDebugInfo}
            className="px-3 py-1 rounded-lg bg-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-300"
          >
            Ko'rsatish
          </button>
        </div>
        {debugInfo && (
          <pre className="bg-white p-3 rounded text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {debugInfo}
          </pre>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Agar printer ulanmasa, bu ma'lumotni menga yuboring.
        </p>
      </div>

      {/* Printer stations */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-3">🖨️ Printer stansiyalari</h3>
        {stations.length === 0 ? (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-3">🖨️</div>
            <h3 className="text-lg font-bold text-amber-900 mb-2">Printer stansiyalari yo'q!</h3>
            <p className="text-amber-800 text-sm mb-4">
              Avval printer stansiyalarini qo'shing — har bir printer uchun bitta stansiya.
            </p>
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
              const isConnected = connected.has(station.id)
              const usbInfo = mapping[station.id]
              const testStatus = testResults[station.id] || 'idle'
              return (
                <div
                  key={station.id}
                  className={`bg-white rounded-2xl border-2 p-5 transition-colors ${
                    isConnected ? 'border-emerald-300' : 'border-slate-200'
                  }`}
                >
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
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {isConnected ? '✓ Ulangan' : '✗ Ulanmagan'}
                    </span>
                  </div>

                  {/* USB device info */}
                  {usbInfo && (
                    <div className="bg-slate-50 rounded-lg p-2 mb-3 text-xs text-slate-600">
                      <div>USB: {usbInfo.productName || `VID:0x${usbInfo.vendorId.toString(16)} PID:0x${usbInfo.productId.toString(16)}`}</div>
                      {usbInfo.manufacturerName && <div>Ishlab chiqaruvchi: {usbInfo.manufacturerName}</div>}
                    </div>
                  )}

                  {/* Test result */}
                  {testStatus !== 'idle' && (
                    <div className={`text-xs font-semibold mb-2 px-2 py-1 rounded ${
                      testStatus === 'testing' ? 'bg-blue-50 text-blue-700' :
                      testStatus === 'ok' ? 'bg-emerald-50 text-emerald-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {testStatus === 'testing' && '⏳ Test qilinmoqda...'}
                      {testStatus === 'ok' && '✓ Chek chiqdi!'}
                      {testStatus === 'fail' && '✗ Chek chiqmadi'}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {!isConnected ? (
                      <button
                        onClick={() => connectPrinter(station.id).catch(e => toast.error(e.message))}
                        className="flex-1 py-2 rounded-lg bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600"
                      >
                        🔌 USB ulash
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleTestPrint(station.id, station.name)}
                          disabled={testStatus === 'testing'}
                          className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-700 font-semibold text-sm hover:bg-blue-100 disabled:opacity-50"
                        >
                          {testStatus === 'testing' ? '⏳...' : '🧪 Test'}
                        </button>
                        <button
                          onClick={() => disconnectPrinter(station.id)}
                          className="px-3 py-2 rounded-lg bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100"
                        >
                          ✗
                        </button>
                      </>
                    )}
                  </div>
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
          <h3 className="text-lg font-bold text-slate-900 mb-3">📋 Print tarixi (oxirgi 30)</h3>
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

      {/* Warning */}
      {stations.length > 0 && connected.size === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="font-semibold text-amber-900">Hech qanday printer ulanmagan!</p>
          <p className="text-sm text-amber-700 mt-1">
            Yuqoridagi "USB ulash" tugmasini bosib, har bir stansiyaga printer biriktiring.
          </p>
        </div>
      )}
    </div>
  )
}
