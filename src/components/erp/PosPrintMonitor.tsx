'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { api, toast } from './utils'
import { useUsbPrinters } from '@/lib/useUsbPrinters'
import { buildKitchenReceipt, buildPaymentReceipt, buildTestReceipt } from '@/lib/escpos'

// ============================================================
// POS PRINT MONITOR
// ============================================================
// Bu komponent POS monoblokda (Chrome brauzer) ishlaydi.
// Har 2 soniyada server'dan print job'larni tekshiradi.
// Yangi job kelganda, tegishli USB printerga ESC/POS data yuboradi.
//
// Foydalanish:
// - Restoran egasi o'z panelida "POS Print Monitor" bo'limini ochadi
// - 4 ta USB printer'ni stansiyalarga biriktiradi
// - Bu sahifa ochiq turadi (background'da polling ishlaydi)
// - Ofitsiantlar telefon'dan buyurtma berganda -> avtomatik print

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
}

export default function PosPrintMonitor() {
  const {
    mapping, connected, supported,
    connectPrinter, disconnectPrinter, print, testPrint
  } = useUsbPrinters()

  const [stations, setStations] = useState<PrinterStation[]>([])
  const [loading, setLoading] = useState(true)
  const [autoPrint, setAutoPrint] = useState(true)
  const [jobQueue, setJobQueue] = useState<PrintJob[]>([])
  const [printLog, setPrintLog] = useState<Array<{ id: string; station: string; time: string; status: 'ok' | 'fail' }>>([])
  const [processing, setProcessing] = useState(false)
  const autoPrintRef = useRef(autoPrint)

  useEffect(() => { autoPrintRef.current = autoPrint }, [autoPrint])

  // Printer stansiyalarini yuklash
  const loadStations = async () => {
    try {
      const res = await api('/api/printers')
      setStations(res.items || [])
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStations() }, [])

  // Print job'larni poll qilish (har 2 soniyada)
  const pollJobs = useCallback(async () => {
    if (!autoPrintRef.current || processing) return

    try {
      const res = await api('/api/print-jobs/auto')
      if (res.jobs && res.jobs.length > 0) {
        setJobQueue(prev => [...prev, ...res.jobs])
      }
    } catch (e) {
      // Silent fail - polling shouldn't show errors
    }
  }, [processing])

  useEffect(() => {
    const interval = setInterval(pollJobs, 2000)
    return () => clearInterval(interval)
  }, [pollJobs])

  // Job queue ni process qilish
  useEffect(() => {
    if (jobQueue.length === 0 || processing) return

    const processNext = async () => {
      const job = jobQueue[0]
      setProcessing(true)

      try {
        // Station ID orqali USB printer topish
        const stationId = job.printerStation.id
        const isConnected = connected.has(stationId)

        if (!isConnected) {
          // Printer ulanmagan - skip va keyin qayta urinish
          setJobQueue(prev => prev.slice(1))
          setPrintLog(prev => [{
            id: job.id,
            station: job.printerStation.name,
            time: new Date().toLocaleTimeString('uz-UZ'),
            status: 'fail'
          }, ...prev].slice(0, 50))
          toast.error(`Printer ulanmagan: ${job.printerStation.name}`)
          return
        }

        // ESC/POS data generatsiya qilish
        const content = job.content
        let escposData: Uint8Array

        if (content.type === 'payment') {
          // Kassa cheki
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
          // Oshxona/order cheki
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

        // Print qilish
        const success = await print(stationId, escposData)

        if (success) {
          // Job'ni "printed" deb belgilash
          await api(`/api/print-jobs/${job.id}/mark-printed`, { method: 'POST' })
          setPrintLog(prev => [{
            id: job.id,
            station: job.printerStation.name,
            time: new Date().toLocaleTimeString('uz-UZ'),
            status: 'ok'
          }, ...prev].slice(0, 50))
        } else {
          // Print failed
          await api(`/api/print-jobs/${job.id}/mark-printed`, { method: 'PUT' })
          setPrintLog(prev => [{
            id: job.id,
            station: job.printerStation.name,
            time: new Date().toLocaleTimeString('uz-UZ'),
            status: 'fail'
          }, ...prev].slice(0, 50))
          toast.error(`Print xatosi: ${job.printerStation.name}`)
        }
      } catch (e: any) {
        console.error('Print process error:', e)
      } finally {
        setJobQueue(prev => prev.slice(1))
        setProcessing(false)
      }
    }

    processNext()
  }, [jobQueue, processing, connected, print])

  // Test print
  const handleTestPrint = async (stationId: string, stationName: string) => {
    try {
      const data = buildTestReceipt(stationName)
      const success = await testPrint(stationId, data)
      if (success) {
        toast.success(`✓ ${stationName} test cheki chiqdi`)
      } else {
        toast.error(`${stationName} print qila olmadi`)
      }
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // WebUSB qo'llab-quvvatlanmaydi
  if (!supported) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-red-900 mb-2">WebUSB qo'llab-quvvatlanmaydi</h2>
          <p className="text-red-700 text-sm mb-4">
            USB printer'ga to'g'ridan-to'g'ri ulanish uchun Chrome yoki Edge brauzer ishlatish kerak.
            Firefox va Safari WebUSB'ni qo'llamaydi.
          </p>
          <div className="bg-white rounded-xl p-4 text-left text-sm">
            <p className="font-semibold text-slate-900 mb-2">Yechim:</p>
            <ol className="list-decimal list-inside text-slate-600 space-y-1">
              <li>Chrome brauzerni yuklab oling</li>
              <li>POS monoblokda Chrome'da dasturni oching</li>
              <li>Qaytadan "POS Print Monitor" bo'limiga kiring</li>
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

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Qanday ishlaydi:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-800">
              <li>Har bir printer stansiyasiga USB printer ulang (tugmani bosing)</li>
              <li>Chrome USB device tanlash oynasini ochadi - printerni tanlang</li>
              <li>"Test" tugmasi bilan tekshiring - chek chiqishi kerak</li>
              <li>Avtomatik print yoqiq bo'lsa - ofitsiant buyurtma berganda avtomatik chop etadi</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Printer stations grid */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-3">🖨️ Printer stansiyalari</h3>
        {stations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <div className="text-4xl mb-2">🖨️</div>
            <p>Printer stansiyalari yo'q.</p>
            <p className="text-sm mt-1">Avval "Printer sozlamalari" bo'limidan stansiyalar qo'shing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stations.map(station => {
              const isConnected = connected.has(station.id)
              const usbInfo = mapping[station.id]
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
                      <div>USB: {usbInfo.productName || `VID:${usbInfo.vendorId.toString(16)} PID:${usbInfo.productId.toString(16)}`}</div>
                      {usbInfo.manufacturerName && <div>Ishlab chiqaruvchi: {usbInfo.manufacturerName}</div>}
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
                          className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-700 font-semibold text-sm hover:bg-blue-100"
                        >
                          🧪 Test
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
          <h3 className="text-lg font-bold text-slate-900 mb-3">📋 Print tarixi</h3>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
            {printLog.map((log, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${log.status === 'ok' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {log.status === 'ok' ? '✓' : '✗'}
                  </span>
                  <div>
                    <div className="font-medium text-slate-900 text-sm">{log.station}</div>
                    <div className="text-xs text-slate-400">{log.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning if no stations connected */}
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
