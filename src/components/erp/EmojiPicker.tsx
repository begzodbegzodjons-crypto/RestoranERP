'use client'

import { useState, useRef, useEffect } from 'react'

// ============================================================
// Taomlar uchun emoji kategoriyalari
// ============================================================
// Har bir kategoriya o'zbek taomlari va umumiy taomlar uchun mo'ljallangan
// Emoji = 4 byte (UTF-8), TiDB'da VARCHAR maydon oz joy egallaydi

export const FOOD_EMOJIS: Record<string, string[]> = {
  '🍵 Oshqalar (suyuq)': [
    '🍲', '🍜', '🍝', '🍵', '🥣', '🥘', '🍛', '🫕', '🍱', '🥡'
  ],
  "🍖 Go'sht taomlari": [
    '🍖', '🍗', '🥩', '🍖', '🥓', '🍔', '🍟', '🌭', '🥓', '🥩',
    '🍖', '🍗', '🥩', '🍢', '🍡', '🥟', '🦴'
  ],
  "🥟 O'zbek milliy taomlari": [
    '🥟', // Manti
    '🍲', // Osh (palov)
    '🍜', // Lag'mon
    '🥖', // Non
    '🫓', // Tandir non
    '🍖', // Shashlik
    '🍢', // Shashlik (variant)
    '🥘', // Qozon kabob
    '🍡', // Somsa
    '🌯', // Norin
    '🥗', // Achichuk
    '🍲', // Shurpa
  ],
  '🍞 Non va yopmalar': [
    '🍞', '🥖', '🫓', '🥐', '🥯', '🧇', '🥞', '🧈', '🥨', '🍞'
  ],
  '🍗 Kaboblar': [
    '🍢', '🍡', '🍗', '🍖', '🥓', '🥩', '🦴', '🍢'
  ],
  '🥗 Salatlar': [
    '🥗', '🥙', '🧆', '🥬', '🥒', '🥕', '🍅', '🫐', '🥑', '🌶️'
  ],
  '🐟 Baliq va dengiz mahsulotlari': [
    '🐟', '🐠', '🐡', '🦐', '🦞', '🦀', '🦑', '🐙', '🦪', '🍣'
  ],
  '🍚 Guruch va makaron': [
    '🍚', '🍛', '🍝', '🍜', '🍢', '🍱', '🥡', '🥢'
  ],
  '🍳 Tuxum taomlari': [
    '🍳', '🥚', '🥘', '🍳', '🧈'
  ],
  '🥤 Ichimliklar': [
    '☕', '🍵', '🥤', '🧃', '🥛', '🍺', '🍷', '🍹', '🥃', '🥂',
    '🍾', '🧉', '🥤', '🧋'
  ],
  '🍰 Shirinliklar': [
    '🍰', '🎂', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍪',
    '🍩', '🍨', '🍦', '🥧'
  ],
  '🍉 Mevalar': [
    '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
    '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅'
  ],
  '🥬 Sabzavotlar': [
    '🥬', '🥒', '🥕', '🌽', '🥔', '🍠', '🧅', '🧄', '🫑', '🌶️',
    '🥦', '🥗', '🍅', '🥑', '🍆'
  ],
  '☕ Issiq ichimliklar': [
    '☕', '🍵', '🫖', '🧋', '☕'
  ],
  '🍺 Alkogolli ichimliklar': [
    '🍺', '🍻', '🍷', '🍹', '🥃', '🥂', '🍾', '🍶'
  ],
  '🍴 Boshqa': [
    '🍴', '🍽️', '🥄', '🔪', '🧂', '🥫', '🥢', '🧂', '🥡', '🍱',
    '🥟', '🥠', '🥡', '🧂'
  ],
  '🌶️ Achchiq taomlar': [
    '🌶️', '🥵', '🔥', '🌶️', '🥘'
  ],
  '🧄 Ziravorlar': [
    '🧄', '🧅', '🫑', '🌶️', '🧂', '🌿', '🥬'
  ],
  "🥜 Yong'oqlar": [
    '🥜', '🌰', '🥜', '🍿', '🧈'
  ],
  '🧀 Sut mahsulotlari': [
    '🧀', '🥛', '🧈', '🥚', '🧀'
  ],
}

// ============================================================
// Emoji Picker komponenti
// ============================================================
export default function EmojiPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (emoji: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(Object.keys(FOOD_EMOJIS)[0])
  const ref = useRef<HTMLDivElement>(null)

  // Tashqariga bosilganda yopiladi
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {/* Tanlangan emoji ko'rsatish + ochish tugmasi */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">{value || '🍽️'}</span>
          <div className="text-left">
            <div className="text-sm font-medium text-slate-700">
              {value ? 'Tanlangan emoji' : 'Emoji tanlanmagan'}
            </div>
            <div className="text-xs text-slate-500">
              {value ? `${value} (o'zgartirish uchun bosing)` : 'Taom uchun emoji tanlang'}
            </div>
          </div>
        </div>
        <svg className={`w-5 h-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Emoji picker dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Kategoriya tablari */}
          <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50 custom-scroll">
            {Object.keys(FOOD_EMOJIS).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-2 text-xs whitespace-nowrap font-medium transition-colors ${
                  activeCategory === cat
                    ? 'text-emerald-600 border-b-2 border-emerald-500 bg-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="p-3 max-h-60 overflow-y-auto custom-scroll">
            <div className="grid grid-cols-8 gap-1">
              {FOOD_EMOJIS[activeCategory].map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => {
                    onChange(emoji)
                    setOpen(false)
                  }}
                  className={`aspect-square flex items-center justify-center text-2xl rounded-lg hover:bg-emerald-50 transition-colors ${
                    value === emoji ? 'bg-emerald-100 ring-2 ring-emerald-400' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">
              {value ? `Joriy: ${value}` : 'Emoji tanlang'}
            </span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                🗑️ Tozalash
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
