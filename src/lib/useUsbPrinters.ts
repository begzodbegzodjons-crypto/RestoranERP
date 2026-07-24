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
      // User'dan USB device tanlashni so'rash - barcha USB device'larni ko'rsatamiz
      const device = await navigator.usb.requestDevice({
        filters: []  // bo'sh - barcha device'larni ko'rsatadi
      })

      // Open
      await device.open()

      // Configuration tanlash - 1 yoki mavjud configuration
      if (device.configuration === null) {
        // Ko'p configuration'li device'lar uchun - 1-ni tanlaymiz
        if (device.configurations.length > 0) {
          await device.selectConfiguration(device.configurations[0].configurationValue)
        }
      }

      // Out endpoint'li interface'ni topish
      const config = device.configuration
      let claimedInterface: USBInterface | null = null

      if (config) {
        // Barcha interface'larni ko'rib chiqamiz - out endpoint'li birini topamiz
        for (const iface of config.interfaces) {
          try {
            await device.claimInterface(iface.interfaceNumber)
            // Out endpoint bormi tekshirish
            const alt = iface.alternate
            const hasOutEndpoint = alt?.endpoints.some(ep => ep.direction === 'out')
            if (hasOutEndpoint) {
              claimedInterface = iface
              break
            } else {
              // Out endpoint yo'q - release qilamiz
              await device.releaseInterface(iface.interfaceNumber)
            }
          } catch (claimErr: any) {
            // Bu interface claim qilinmadi - keyingisiga o'tamiz
            console.warn(`[usb-printer] Interface ${iface.interfaceNumber} claim failed:`, claimErr.message)
          }
        }

        // Out endpoint topilmasa - 0-interface'ni majburan claim qilamiz
        if (!claimedInterface && config.interfaces.length > 0) {
          const iface = config.interfaces[0]
          try {
            await device.claimInterface(iface.interfaceNumber)
            claimedInterface = iface
          } catch (e) {
            throw new Error(`Hech qanday interface claim qilinmadi. Printer driver holatini tekshiring.`)
          }
        }
      }

      if (!claimedInterface) {
        await device.close()
        throw new Error('USB printer\'da hech qanday interface topilmadi.')
      }

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
    let device = connectedDevices.get(stationId)

    // Device yo'q yoki yopiq bo'lsa - reconnect
    if (!device || !device.opened) {
      const info = mapping[stationId]
      if (info) {
        try {
          const devices = await navigator.usb.getDevices()
          const dev = devices.find(d =>
            d.vendorId === info.vendorId && d.productId === info.productId
          )
          if (dev) {
            await dev.open()
            if (dev.configuration === null && dev.configurations.length > 0) {
              await dev.selectConfiguration(dev.configurations[0].configurationValue)
            }

            // Out endpoint'li interface'ni topish
            const config = dev.configuration
            if (config) {
              for (const iface of config.interfaces) {
                try {
                  await dev.claimInterface(iface.interfaceNumber)
                  const alt = iface.alternate
                  const hasOut = alt?.endpoints.some(ep => ep.direction === 'out')
                  if (hasOut) break
                  await dev.releaseInterface(iface.interfaceNumber)
                } catch {}
              }
            }

            connectedDevices.set(stationId, dev)
            device = dev
          }
        } catch (e) {
          console.error('[usb-printer] Reconnect failed:', e)
        }
      }
    }

    if (!device || !device.opened) {
      return false
    }

    try {
      // Barcha interface'larni ko'rib chiqib, out endpoint'li birini topish
      const config = device.configuration
      if (!config) {
        console.error('[usb-printer] No configuration')
        return false
      }

      let outEndpoint: USBEndpoint | null = null

      for (const iface of config.interfaces) {
        if (!iface.claimed) {
          try {
            await device.claimInterface(iface.interfaceNumber)
          } catch { continue }
        }
        const alt = iface.alternate
        const ep = alt?.endpoints.find(e => e.direction === 'out')
        if (ep) {
          outEndpoint = ep
          break
        }
      }

      if (!outEndpoint) {
        console.error('[usb-printer] No output endpoint found in any interface')
        return false
      }

      // Data yuborish - kichik bo'laklarda (USB buffer limit uchun)
      const CHUNK_SIZE = 1024
      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const chunk = data.slice(offset, Math.min(offset + CHUNK_SIZE, data.length))
        await device.transferOut(outEndpoint.endpointNumber, chunk)
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
