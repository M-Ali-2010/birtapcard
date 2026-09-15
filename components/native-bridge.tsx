'use client'

import { useEffect, useState } from 'react'
import { requestRefresh } from './nav-config'

/**
 * Когда сайт открыт внутри мобильного приложения (Capacitor), в страницу
 * встроен window.Capacitor. Здесь мы:
 *  - помечаем <html class="is-native"> — CSS убирает «браузерные» мелочи;
 *  - гасим нативную заставку, как только React отрисовался;
 *  - даём лёгкую вибрацию на главные кнопки — ощущается как родное приложение.
 * В обычном браузере компонент ничего не делает.
 */

type CapacitorLike = {
  isNativePlatform?: () => boolean
  Plugins?: {
    SplashScreen?: { hide: (o?: { fadeOutDuration?: number }) => Promise<void> }
    Haptics?: { impact: (o: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void> }
  }
}

declare global {
  interface Window { Capacitor?: CapacitorLike }
}

export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()
}

export async function haptic(style: 'LIGHT' | 'MEDIUM' | 'HEAVY' = 'LIGHT') {
  try { await window.Capacitor?.Plugins?.Haptics?.impact({ style }) } catch {}
}

const PULL_MAX = 96
const PULL_TRIGGER = 68

export function NativeBridge() {
  const [pull, setPull] = useState(0)
  const [spinning, setSpinning] = useState(false)

  // Потянуть страницу вниз от самого верха — обновить данные, как в родных приложениях
  useEffect(() => {
    if (!isNativeApp()) return
    let startY = 0
    let active = false
    let dist = 0

    const atTop = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0
    const inSheet = (t: EventTarget | null) =>
      !!(t as HTMLElement | null)?.closest?.('.modal-root, .cmdk-root, .sidebar, input, textarea')

    const onStart = (e: TouchEvent) => {
      if (!atTop() || inSheet(e.target)) return
      startY = e.touches[0].clientY
      active = true
      dist = 0
    }
    const onMove = (e: TouchEvent) => {
      if (!active) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || !atTop()) { if (dist) { dist = 0; setPull(0) } return }
      dist = Math.min(PULL_MAX, dy * 0.55)
      setPull(dist)
    }
    const onEnd = () => {
      if (!active) return
      active = false
      if (dist >= PULL_TRIGGER) {
        haptic('MEDIUM')
        setSpinning(true)
        requestRefresh()
        setTimeout(() => { setSpinning(false); setPull(0) }, 900)
      } else {
        setPull(0)
      }
      dist = 0
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  useEffect(() => {
    if (!isNativeApp()) return
    document.documentElement.classList.add('is-native')

    // Заставка живёт, пока не отрисуется первый кадр интерфейса
    const t = setTimeout(() => {
      window.Capacitor?.Plugins?.SplashScreen?.hide({ fadeOutDuration: 320 }).catch(() => {})
    }, 250)

    // Вибро на нажатие главных кнопок и пунктов нижнего меню
    const onDown = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.('.btn--primary, .bottom-nav__item, .segmented__item, .switch')
      if (el) haptic('LIGHT')
    }
    document.addEventListener('pointerdown', onDown, { passive: true })

    return () => {
      clearTimeout(t)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [])

  if (!pull && !spinning) return null
  const p = Math.min(1, pull / PULL_TRIGGER)
  return (
    <div
      className={`ptr${spinning ? ' ptr--spin' : ''}`}
      style={{ opacity: spinning ? 1 : p, transform: `translate(-50%, ${spinning ? 18 : pull * 0.5 - 20}px) rotate(${p * 270}deg)` }}
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" />
      </svg>
    </div>
  )
}
