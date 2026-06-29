'use client'

import { useState } from 'react'
import { toast, formatMoney } from './utils'

export default function ExportView() {
  const [downloading, setDownloading] = useState<string | null>(null)

  const download = async (type: 'sales' | 'products' | 'customers') => {
    setDownloading(type)
    try {
      const res = await fetch(`/api/export/${type}`)
      if (!res.ok) throw new Error('Eksport xatosi')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `${type}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Fayl yuklab olindi')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDownloading(null)
    }
  }

  const exports = [
    {
      type: 'sales' as const,
      icon: '🧾',
      title: 'Savdo tarixi',
      desc: 'Barcha savdolar (chek #, sana, summa, foyda, to\'lov turi, pozitsiyalar)',
      color: 'from-emerald-500 to-teal-600'
    },
    {
      type: 'products' as const,
      icon: '🍽️',
      title: 'Mahsulotlar',
      desc: 'Mahsulotlar ro\'yxati (narx, tannarx, foyda, marja %)',
      color: 'from-blue-500 to-cyan-600'
    },
    {
      type: 'customers' as const,
      icon: '👥',
      title: 'Mijozlar',
      desc: 'Mijozlar bazasi (telefon, buyurtmalar, sarflagan, loyalty ballari)',
      color: 'from-purple-500 to-pink-600'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">📤 Eksport markazi</h2>
        <p className="text-slate-500 text-sm">Ma'lumotlarni Excel/CSV formatida yuklab oling</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="font-semibold text-amber-900 mb-1">ℹ️ Excel da ochish</div>
        <p className="text-sm text-amber-800">
          Yuklab olingan CSV fayllar Excel dasturida to'g'ridan-to'g'ri ochiladi.
          UTF-8 formatida saqlangan (o'zbek harflari to'g'ri ko'rinadi).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {exports.map(exp => (
          <div key={exp.type} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${exp.color} flex items-center justify-center text-2xl mb-4 shadow-md`}>
              {exp.icon}
            </div>
            <h3 className="font-bold text-slate-900 mb-2">{exp.title}</h3>
            <p className="text-sm text-slate-500 mb-4">{exp.desc}</p>
            <button
              onClick={() => download(exp.type)}
              disabled={downloading === exp.type}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {downloading === exp.type ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Yuklab olinmoqda...
                </span>
              ) : `📥 CSV yuklab olish`}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-3">📋 Eksport qilingan ma'lumotlar nima uchun kerak?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex gap-3">
            <div className="text-2xl">📊</div>
            <div>
              <div className="font-semibold text-slate-900">Soliq hisoboti</div>
              <p className="text-slate-600">Oylik soliq deklaratsiyasi uchun savdo tarixini oling</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-2xl">👥</div>
            <div>
              <div className="font-semibold text-slate-900">Marketing</div>
              <p className="text-slate-600">Mijozlar bazasini olib, SMS/email orqali reklama yuboring</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-2xl">📈</div>
            <div>
              <div className="font-semibold text-slate-900">Tahlil</div>
              <p className="text-slate-600">Excel da pivot jadvallar va grafiklar yarating</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-2xl">💾</div>
            <div>
              <div className="font-semibold text-slate-900">Zaxira nusxa</div>
              <p className="text-slate-600">Ma'lumotlarni zaxira sifatida saqlang</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
