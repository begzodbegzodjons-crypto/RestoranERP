'use client'

import { useMemo } from 'react'

/**
 * HeroTitle - bosh sahifadagi yirik yozuv
 *
 * Effektlar:
 * - Yorqin emerald gradient (HAR DOIM ko'rinadigan, hex ranglar bilan)
 * - Gradient yaltirash (shimmer) - 4s
 * - Float - 5s yuqoriga-pastga harakat
 * - "bir tizimda" - maxsus cyan gradient + drop-shadow glow + scale pulse
 * - So'zlar ketma-ket paydo bo'lishi (bounce easing bilan)
 * - Light sweep - oq nur yozuv ustidan o'tadi
 * - 8 ta sparkle (yulduzcha) yozuv atrofida
 */
export default function HeroTitle() {
  const sparkles = useMemo(() => [
    { top: '-5%', left: '8%', delay: '0s', size: 4 },
    { top: '15%', left: '92%', delay: '0.5s', size: 6 },
    { top: '60%', left: '2%', delay: '1s', size: 5 },
    { top: '85%', left: '85%', delay: '1.5s', size: 4 },
    { top: '30%', left: '50%', delay: '2s', size: 7 },
    { top: '-10%', left: '60%', delay: '0.8s', size: 5 },
    { top: '70%', left: '40%', delay: '1.3s', size: 6 },
    { top: '5%', left: '30%', delay: '2.5s', size: 4 },
  ], [])

  return (
    <h1 className="text-5xl xl:text-6xl 2xl:text-7xl font-bold leading-tight tracking-tight relative">
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
        {/* Light sweep overlay - yozuv ustidan o'tadigan oq nur */}
        <span className="hero-sweep-overlay" aria-hidden="true" />
      </span>
    </h1>
  )
}
