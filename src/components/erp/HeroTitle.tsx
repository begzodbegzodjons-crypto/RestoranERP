'use client'

import { useMemo } from 'react'

/**
 * HeroTitle - bosh sahifadagi yirik yozuv
 * Effektlar:
 * - Gradient yaltirash (shimmer)
 * - Yaltirab yonuvchi light sweep (2 ta, ikki yo'nalishda)
 * - 3D float (yuqoriga-pastga harakat)
 * - Glow (yorug'lik halqasi)
 * - Highlight so'z uchun maxsus pulse + drop-shadow
 * - So'zlar ketma-ket paydo bo'lishi (3D rotateX bilan)
 * - Sparkles (yulduzchalar) yozuv atrofida
 */
export default function HeroTitle() {
  // Sparklelar uchun tasodifiy pozitsiyalar (har renderda o'zgarmaydi)
  const sparkles = useMemo(() => {
    const positions = [
      { top: '-5%', left: '8%', delay: '0s', size: 4 },
      { top: '15%', left: '92%', delay: '0.5s', size: 6 },
      { top: '60%', left: '2%', delay: '1s', size: 5 },
      { top: '85%', left: '85%', delay: '1.5s', size: 4 },
      { top: '30%', left: '50%', delay: '2s', size: 7 },
      { top: '-10%', left: '60%', delay: '0.8s', size: 5 },
      { top: '70%', left: '40%', delay: '1.3s', size: 6 },
      { top: '5%', left: '30%', delay: '2.5s', size: 4 },
    ]
    return positions
  }, [])

  return (
    <h1
      className="text-5xl xl:text-6xl 2xl:text-7xl font-bold leading-tight tracking-tight hero-glow relative"
      data-text="Restoraningizni bir tizimda boshqaring"
    >
      {/* Sparkles - yozuv atrofida uchqunlar */}
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="hero-sparkle"
          style={{
            top: s.top,
            left: s.left,
            animationDelay: s.delay,
            width: `${s.size}px`,
            height: `${s.size}px`,
          }}
        />
      ))}

      <span className="hero-title-wrapper">
        <span className="hero-title">
          <span className="hero-word">Restoraningizni</span>{' '}
          <span className="hero-word hero-highlight">bir tizimda</span>{' '}
          <span className="hero-word">boshqaring</span>
        </span>
      </span>
    </h1>
  )
}
