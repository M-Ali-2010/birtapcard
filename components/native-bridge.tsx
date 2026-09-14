'use client'

import { useEffect } from 'react'

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

export function NativeBridge() {
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

  return null
}
