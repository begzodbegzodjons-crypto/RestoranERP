// WebUSB printer management hook
// ============================================================================
// 4 ta USB thermal printerga ulanish va boshqarish
// Xprinter XP-58IIH, XP-80IIH, XP-350II va boshqa ESC/POS printerlar uchun

import { useState, useEffect, useCallback, useRef } from 'react'

export type UsbDeviceInfo = {
  vendorId: number
  productId: number
  serialNumber?: string
  productName?: string
  manufacturerName?: string
}

type PrinterMapping = {
  [stationId: string]: UsbDeviceInfo | null
}

const STORAGE_KEY = 'usb_printer_mapping_v2'

// Singleton - page refresh bo'lsa ham device saqlanadi
const deviceStore = new Map<string, USBDevice>()
// Har bir device uchun out endpoint raqami
const endpointStore = new Map<string, number>()

export function useUsbPrinters() {
  const [mapping, setMapping] = useState<PrinterMapping>({})
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  // WebUSB qo'llab-quvvatlashni tekshirish
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.usb) {
      setSupported(false)
      return
    }

    // Mapping'ni localStorage'dan yuklash
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setMapping(JSON.parse(saved))
      }
    } catch {}

    // Avval ulangan device'larni qayta ulash
    const reconnectAll = async () => {
      try {
        const devices = await navigator.usb.getDevices()
        const savedMapping = localStorage.getItem(STORAGE_KEY)
        if (!savedMapping || devices.length === 0) return

        const parsed = JSON.parse(savedMapping) as PrinterMapping
        for (const [stationId, info] of Object.entries(parsed)) {
          if (!info) continue
          const device = devices.find(d =>
            d.vendorId === info.vendorId && d.productId === info.productId
          )
          if (device) {
            const ok = await openAndClaim(device)
            if (ok) {
              deviceStore.set(stationId, device)
              setConnected(prev => new Set(prev).add(stationId))
            }
          }
        }
      } catch (e) {
        console.warn('[usb-printer] Reconnect failed:', e)
      }
    }

    if (!initialized.current) {
      initialized.current = true
      reconnectAll()
    }

    const disconnectHandler = (event: USBConnectionEvent) => {
      for (const [stationId, dev] of deviceStore.entries()) {
        if (dev === event.device) {
          deviceStore.delete(stationId)
          endpointStore.delete(stationId)
          setConnected(prev => {
            const next = new Set(prev)
            next.delete(stationId)
            return next
          })
        }
      }
    }

    navigator.usb.addEventListener('disconnect', disconnectHandler)
    return () => navigator.usb.removeEventListener('disconnect', disconnectHandler)
  }, [])

  // Device'ni ochish va interface claim qilish
  const openAndClaim = async (device: USBDevice): Promise<boolean> => {
    try {
      if (!device.opened) {
        await device.open()
      }

      // Configuration tanlash
      if (device.configuration === null) {
        if (device.configurations.length > 0) {
          await device.selectConfiguration(device.configurations[0].configurationValue)
        } else {
          return false
        }
      }

      const config = device.configuration
      if (!config) return false

      // Barcha interface'larni ko'rib chiqib, out endpoint'li birini topish
      for (const iface of config.interfaces) {
        // Release avval claim qilingan bo'lsa
        if (iface.claimed) {
          try { await device.releaseInterface(iface.interfaceNumber) } catch {}
        }
        try {
          await device.claimInterface(iface.interfaceNumber)
          const alt = iface.alternate
          if (alt) {
            const outEp = alt.endpoints.find(ep => ep.direction === 'out')
            if (outEp) {
              // Bu interface out endpoint'ga ega - saqlaymiz
              return true
            }
          }
          // Out endpoint yo'q - release qilamiz
          try { await device.releaseInterface(iface.interfaceNumber) } catch {}
        } catch (e) {
          // Claim failed - keyingi interface
        }
      }

      // Hech qaysi interface'da out endpoint topilmadi - 0-interface'ni majburan claim
      if (config.interfaces.length > 0) {
        const iface = config.interfaces[0]
        try {
          await device.claimInterface(iface.interfaceNumber)
          return true
        } catch {
          return false
        }
      }

      return false
    } catch (e) {
      console.error('[usb-printer] openAndClaim error:', e)
      return false
    }
  }

  // Out endpoint raqamini topish
  const findOutEndpoint = (device: USBDevice): number | null => {
    const config = device.configuration
    if (!config) return null

    for (const iface of config.interfaces) {
      if (!iface.claimed) continue
      const alt = iface.alternate
      if (alt) {
        const ep = alt.endpoints.find(e => e.direction === 'out')
        if (ep) return ep.endpointNumber
      }
    }
    return null
  }

  // USB device'ni tanlash va station'ga biriktirish
  const connectPrinter = useCallback(async (stationId: string): Promise<boolean> => {
    if (!navigator.usb) {
      setError('WebUSB qo\'llab-quvvatlanmaydi')
      return false
    }

    setError(null)

    try {
      // Barcha USB device'larni ko'rsatish
      const device = await navigator.usb.requestDevice({ filters: [] })

      const ok = await openAndClaim(device)
      if (!ok) {
        setError('Printer interface\'ga ulana olmadi. Printerni qayta ulang.')
        return false
      }

      // Out endpoint'ni topish
      const endpointNum = findOutEndpoint(device)
      if (endpointNum === null) {
        setError('Printer\'da out endpoint topilmadi')
        return false
      }

      deviceStore.set(stationId, device)
      endpointStore.set(stationId, endpointNum)

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
      if (e.name === 'NotFoundError') return false
      const msg = e.message || 'Noma\'lum xato'
      setError(msg)
      throw e
    }
  }, [mapping])

  // USB device'ni uzish
  const disconnectPrinter = useCallback(async (stationId: string) => {
    const device = deviceStore.get(stationId)
    if (device) {
      try {
        // Barcha interface'larni release qilish
        const config = device.configuration
        if (config) {
          for (const iface of config.interfaces) {
            if (iface.claimed) {
              try { await device.releaseInterface(iface.interfaceNumber) } catch {}
            }
          }
        }
        await device.close()
      } catch {}
      deviceStore.delete(stationId)
      endpointStore.delete(stationId)
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
    let device = deviceStore.get(stationId)

    // Device yo'q yoki yopiq - reconnect
    if (!device || !device.opened) {
      const info = mapping[stationId]
      if (!info) return false

      try {
        const devices = await navigator.usb.getDevices()
        const dev = devices.find(d =>
          d.vendorId === info.vendorId && d.productId === info.productId
        )
        if (!dev) return false

        const ok = await openAndClaim(dev)
        if (!ok) return false

        const ep = findOutEndpoint(dev)
        if (ep === null) return false

        deviceStore.set(stationId, dev)
        endpointStore.set(stationId, ep)
        device = dev
      } catch (e) {
        console.error('[usb-printer] Reconnect failed:', e)
        return false
      }
    }

    if (!device) return false

    const endpointNum = endpointStore.get(stationId)
    if (endpointNum === undefined) {
      // Qayta topish
      const ep = findOutEndpoint(device)
      if (ep === null) return false
      endpointStore.set(stationId, ep)
    }

    const epNum = endpointStore.get(stationId)!
    try {
      // Kichik bo'laklarda yuborish - USB buffer limit (4KB dan kam)
      const CHUNK_SIZE = 512
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const end = Math.min(offset + CHUNK_SIZE, data.length)
        const chunk = data.slice(offset, end)
        const result = await device.transferOut(epNum, chunk)
        if (result.status !== 'ok') {
          console.error('[usb-printer] Transfer failed:', result.status)
          return false
        }
      }
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
    for (const stationId of Array.from(deviceStore.keys())) {
      await disconnectPrinter(stationId)
    }
  }, [disconnectPrinter])

  return {
    mapping,
    connected,
    supported,
    error,
    connectPrinter,
    disconnectPrinter,
    print,
    testPrint,
    disconnectAll,
  }
}
