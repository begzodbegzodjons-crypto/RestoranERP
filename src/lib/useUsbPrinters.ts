'use client'

// WebUSB Printer Manager
// ============================================================================
// 4 ta USB thermal printerga ulanish va boshqarish
// Xprinter XP-58IIH, XP-80IIH va boshqa ESC/POS printerlar uchun
//
// Islatish:
//   const manager = useUsbPrinters()
//   await manager.connectPrinter('shashlik')  // USB device tanlash
//   await manager.print('shashlik', escposData)  // print qilish

import { useState, useEffect, useCallback, useRef } from 'react'

// USB device ma'lumotlari
export type UsbDeviceInfo = {
  vendorId: number
  productId: number
  serialNumber?: string
  productName?: string
  manufacturerName?: string
}

// Printer station mapping (localStorage'da saqlanadi)
type PrinterMapping = {
  [stationId: string]: UsbDeviceInfo | null
}

const STORAGE_KEY = 'usb_printer_mapping'

// Xprinter va boshqa thermal printer VID'lari
// Agar aniq bilmasangiz, bo'sh qoldiring - user har qanday USB device tanlay oladi
const PRINTER_VIDS = [
  0x0416,  // Winbond / Generic thermal
  0x0483,  // STMicroelectronics
  0x1FC9,  // NXP
  0x04B8,  // Epson
  0x0519,  // Xprinter (some models)
  0x154F,  // Xprinter (other models)
  0x1659,  // Generic
  0x28E9,  // GD32 (some XP-58)
]

// Singleton USB device storage (component re-render bo'lsa ham saqlanadi)
const connectedDevices = new Map<string, USBDevice>()

// ============================================================
// HOOK: useUsbPrinters
// ============================================================
export function useUsbPrinters() {
  const [mapping, setMapping] = useState<PrinterMapping>({})
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [supported, setSupported] = useState(true)
  const initialized = useRef(false)

  // WebUSB qo'llab-quvvatlashni tekshirish
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.usb) {
      setSupported(false)
      return
    }

    // Load mapping from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setMapping(JSON.parse(saved))
      }
    } catch {}

    // Avval ulangan device'larni qayta ulash (page refresh bo'lganda)
    const reconnectAll = async () => {
      const savedMapping = localStorage.getItem(STORAGE_KEY)
      if (!savedMapping) return

      const parsed = JSON.parse(savedMapping) as PrinterMapping
      for (const [stationId, info] of Object.entries(parsed)) {
        if (!info) continue
        try {
          const devices = await navigator.usb.getDevices()
          const device = devices.find(d =>
            d.vendorId === info.vendorId &&
            d.productId === info.productId
          )
          if (device) {
            await device.open()
            if (device.configuration === null) {
              await device.selectConfiguration(1)
            }
            await device.claimInterface(0)
            connectedDevices.set(stationId, device)
            setConnected(prev => new Set(prev).add(stationId))
          }
        } catch (e) {
          console.warn(`[usb-printer] Reconnect failed for ${stationId}:`, e)
        }
      }
    }

    if (!initialized.current) {
      initialized.current = true
      reconnectAll()
    }

    // USB disconnect listener
    const disconnectHandler = (event: USBConnectionEvent) => {
      const device = event.device
      for (const [stationId, dev] of connectedDevices.entries()) {
        if (dev === device) {
          connectedDevices.delete(stationId)
          setConnected(prev => {
            const next = new Set(prev)
            next.delete(stationId)
            return next
          })
        }
      }
    }

    navigator.usb.addEventListener('disconnect', disconnectHandler)
    return () => {
      navigator.usb.removeEventListener('disconnect', disconnectHandler)
    }
  }, [])

  // USB device'ni tanlash va station'ga biriktirish
  const connectPrinter = useCallback(async (stationId: string): Promise<boolean> => {
    if (!navigator.usb) return false

    try {
      // User'dan USB device tanlashni so'rash
      const filters = PRINTER_VIDS.map(vid => ({ vendorId: vid }))
      // Also allow any device (user picks)
      const device = await navigator.usb.requestDevice({
        filters: [...filters, {}]  // empty filter = show all devices
      })

      // Open and configure
      await device.open()
      if (device.configuration === null) {
        await device.selectConfiguration(1)
      }
      await device.claimInterface(0)

      // Store device
      connectedDevices.set(stationId, device)

      // Save mapping
      const info: UsbDeviceInfo = {
        vendorId: device.vendorId,
        productId: device.productId,
        serialNumber: device.serialNumber || undefined,
        productName: device.productName || undefined,
        manufacturerName: device.manufacturerName || undefined,
      }

      const newMapping = { ...mapping, [stationId]: info }
      setMapping(newMapping)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newMapping))

      setConnected(prev => new Set(prev).add(stationId))

      return true
    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        // User cancelled - not an error
        return false
      }
      console.error('[usb-printer] Connect error:', e)
      throw e
    }
  }, [mapping])

  // USB device'ni uzish
  const disconnectPrinter = useCallback(async (stationId: string) => {
    const device = connectedDevices.get(stationId)
    if (device) {
      try {
        await device.close()
      } catch {}
      connectedDevices.delete(stationId)
    }

    setConnected(prev => {
      const next = new Set(prev)
      next.delete(stationId)
      return next
    })

    const newMapping = { ...mapping, [stationId]: null }
    setMapping(newMapping)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMapping))
  }, [mapping])

  // Printerga raw data yuborish
  const print = useCallback(async (stationId: string, data: Uint8Array): Promise<boolean> => {
    const device = connectedDevices.get(stationId)
    if (!device || !device.opened) {
      // Try to reconnect
      const info = mapping[stationId]
      if (info) {
        try {
          const devices = await navigator.usb.getDevices()
          const dev = devices.find(d =>
            d.vendorId === info.vendorId && d.productId === info.productId
          )
          if (dev) {
            await dev.open()
            if (dev.configuration === null) await dev.selectConfiguration(1)
            await dev.claimInterface(0)
            connectedDevices.set(stationId, dev)
            return print(stationId, data)
          }
        } catch (e) {
          console.error('[usb-printer] Reconnect failed:', e)
        }
      }
      return false
    }

    try {
      // Find output endpoint (usually endpoint 1, direction 'out')
      const config = device.configuration
      const iface = config?.interfaces[0]
      const alt = iface?.alternate
      const endpoint = alt?.endpoints.find(ep => ep.direction === 'out')

      if (!endpoint) {
        console.error('[usb-printer] No output endpoint found')
        return false
      }

      await device.transferOut(endpoint.endpointNumber, data)
      return true
    } catch (e) {
      console.error('[usb-printer] Print error:', e)
      return false
    }
  }, [mapping])

  // Test print
  const testPrint = useCallback(async (stationId: string, data: Uint8Array): Promise<boolean> => {
    return print(stationId, data)
  }, [print])

  // Barcha printerlarni uzish
  const disconnectAll = useCallback(async () => {
    for (const stationId of connectedDevices.keys()) {
      await disconnectPrinter(stationId)
    }
  }, [disconnectPrinter])

  return {
    mapping,
    connected,
    supported,
    connectPrinter,
    disconnectPrinter,
    print,
    testPrint,
    disconnectAll,
  }
}
