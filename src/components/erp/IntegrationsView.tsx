'use client'

import { useState } from 'react'
import { api, toast, Modal } from './utils'

export default function IntegrationsView() {
  const [downloading1C, setDownloading1C] = useState(false)
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [mapsModal, setMapsModal] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [mapsData, setMapsData] = useState<any | null>(null)
  const [loadingMaps, setLoadingMaps] = useState(false)

  const export1C = async () => {
    setDownloading1C(true)
    try {
      const res = await fetch(`/api/integrations/1c-export?from=${from}&to=${to}`)
      if (!res.ok) throw new Error('Eksport xatosi')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `1c-buxgalteriya-${from}-to-${to}.xml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('1C XML fayl yuklab olindi')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDownloading1C(false)
    }
  }

  const generateMap = async () => {
    if (!deliveryAddress) {
      toast.error('Mijoz manzilini kiriting')
      return
    }
    setLoadingMaps(true)
    try {
      const res = await api('/api/integrations/maps', {
        method: 'POST',
        body: JSON.stringify({ customerAddress: deliveryAddress })
      })
      setMapsData(res)
      toast.success('Xarita tayyor!')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingMaps(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">🔌 Tashqi integratsiyalar</h2>
        <p className="text-slate-500 text-sm">1C Buxgalteriya va xaritalar bilan ishlash</p>
      </div>

      {/* 1C Integration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-red-500 flex items-center justify-center text-2xl shadow-md">
            📊
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 text-lg">1C Buxgalteriya integratsiyasi</h3>
            <p className="text-sm text-slate-500">
              Soliq hisoboti uchun ma'lumotlarni 1C formatida (CommerceML 2.0 XML) eksport qiling.
              Savdo, xarajatlar, xaridlar va QQS hisoblanadi.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="font-semibold text-amber-900 mb-1">📋 Eksportda nima bor?</div>
          <ul className="text-sm text-amber-800 space-y-1">
            <li>✓ Barcha savdo hujjatlari (chek raqami, sana, summa, QQS)</li>
            <li>✓ Xarajatlar (kategoriya, summa, sana)</li>
            <li>✓ Xaridlar (yetkazib beruvchi, ingredientlar, summa)</li>
            <li>✓ Mijozlar ma'lumotlari</li>
            <li>✓ Avtomatik QQS hisoblash (Sozlamalarda % kiritiladi)</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Boshlang'ich sana</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="erp-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tugash sanasi</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="erp-input"
            />
          </div>
        </div>

        <button
          onClick={export1C}
          disabled={downloading1C}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-red-500 text-white font-bold shadow-lg disabled:opacity-50"
        >
          {downloading1C ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Eksport qilinmoqda...
            </span>
          ) : '📥 1C XML eksport'}
        </button>

        <p className="text-xs text-slate-500 mt-3">
          💡 Fayl 1C da "Imperiya" yoki "Buxgalteriya" moduliga import qilinadi.
          QQS foizini Sozlamalar bo'limida o'rnating.
        </p>
      </div>

      {/* Maps Integration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl shadow-md">
            🗺️
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 text-lg">Yandex/Google Maps integratsiyasi</h3>
            <p className="text-sm text-slate-500">
              Yetkazib berish manzillari uchun xarita va marshrut yarating.
              Yandex va Google Maps da ko'rish, iframe ga joylash.
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="font-semibold text-blue-900 mb-1">📍 Xarita integratsiyasi imkoniyatlari</div>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Restoran manzilini xaritada ko'rsatish</li>
            <li>✓ Yetkazib berish manziliga marshrut (Yandex/Google)</li>
            <li>✓ Masofa va vaqt hisoblash</li>
            <li>✓ Iframe formatida joylashtirish</li>
            <li>✓ To'g'ridan-to'g'ri Yandex/Google app da ochish</li>
          </ul>
        </div>

        <button
          onClick={() => setMapsModal(true)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold shadow-lg"
        >
          🗺️ Yetkazib berish xaritasini yaratish
        </button>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-3">⚡ Tezkor integratsiyalar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a
            href="https://t.me/norinkomp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <div className="text-2xl">💬</div>
            <div>
              <div className="font-semibold text-blue-900">Telegram bot</div>
              <div className="text-xs text-blue-700">Sozlamalardan bog'lang</div>
            </div>
          </a>
          <a
            href="https://help.1c.ru/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl bg-yellow-50 hover:bg-yellow-100 transition-colors"
          >
            <div className="text-2xl">📚</div>
            <div>
              <div className="font-semibold text-yellow-900">1C dokumentatsiyasi</div>
              <div className="text-xs text-yellow-700">Import qo'llanmasi</div>
            </div>
          </a>
        </div>
      </div>

      {/* Maps modal */}
      <Modal open={mapsModal} onClose={() => { setMapsModal(false); setMapsData(null) }} title="🗺️ Yetkazib berish xaritasi" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mijoz manzili</label>
            <input
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              className="erp-input"
              placeholder="Toshkent, Chilonzor, ko'cha 1, uy 2"
            />
          </div>

          <button
            onClick={generateMap}
            disabled={loadingMaps}
            className="w-full py-3 rounded-xl bg-blue-500 text-white font-bold disabled:opacity-50"
          >
            {loadingMaps ? 'Yaratilmoqda...' : '🗺️ Xaritani yaratish'}
          </button>

          {mapsData && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-sm text-slate-600 mb-1">Manzil:</div>
                <div className="font-semibold">{mapsData.delivery.customerAddress}</div>
              </div>

              {/* Yandex map embed */}
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2">Yandex Maps:</div>
                <iframe
                  src={mapsData.maps.yandexEmbed}
                  width="100%"
                  height="300"
                  style={{ border: 0, borderRadius: '12px' }}
                  allowFullScreen
                />
                <a
                  href={mapsData.maps.yandexRoute}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2 text-center py-2 rounded-lg bg-yellow-500 text-white font-semibold text-sm"
                >
                  🟡 Yandex app da ochish
                </a>
              </div>

              {/* Google map embed */}
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2">Google Maps:</div>
                <iframe
                  src={mapsData.maps.googleEmbed}
                  width="100%"
                  height="300"
                  style={{ border: 0, borderRadius: '12px' }}
                  allowFullScreen
                />
                <a
                  href={mapsData.maps.googleRoute}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2 text-center py-2 rounded-lg bg-blue-500 text-white font-semibold text-sm"
                >
                  🔵 Google app da ochish
                </a>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
