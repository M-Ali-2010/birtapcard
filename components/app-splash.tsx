'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from '@/components/ui/icons'
import { haptic, isNativeApp } from '@/components/native-bridge'

/**
 * Заставка и онбординг приложения.
 *  - Заставка: знак + BirTapCard + слоган, ~1.6 с, при каждом холодном старте
 *    приложения (Capacitor или PWA с домашнего экрана). В обычном браузере — нет.
 *  - Онбординг: три экрана о продукте, один раз на устройство, только на /login
 *    (кто уже вошёл — его не видит). Ключ в localStorage: btc:onboarded.
 */

const ONBOARDED_KEY = 'btc:onboarded'
const SPLASH_MS = 1650

const SLIDES: { icon: IconName; title: string; text: string; accent: string }[] = [
  {
    icon: 'nfc',
    title: 'Одно касание —\nодин отзыв',
    text: 'Гость прикладывает телефон к карточке или сканирует QR — и сразу попадает на страницу отзыва.',
    accent: 'var(--mint)',
  },
  {
    icon: 'layers',
    title: 'Все площадки\nна одном экране',
    text: 'Google, Яндекс Карты, 2ГИС, Instagram, Telegram. Вы решаете, какие кнопки видит гость.',
    accent: 'var(--blue)',
  },
  {
    icon: 'analytics',
    title: 'Вся статистика\nв кармане',
    text: 'Сканы, уникальные гости, переходы по кнопкам и отчёты в Telegram — в реальном времени.',
    accent: 'var(--purple)',
  },
]

function isStandalone() {
  return typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
}

export function AppSplash() {
  const pathname = usePathname()
  const [phase, setPhase] = useState<'idle' | 'splash' | 'out' | 'onboarding' | 'done'>('idle')
  const [slide, setSlide] = useState(0)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    const app = isNativeApp() || isStandalone()
    const forced = new URLSearchParams(window.location.search).has('splash')
    if (!app && !forced) { setPhase('done'); return }

    setPhase('splash')
    const t1 = setTimeout(() => setPhase('out'), SPLASH_MS)
    const t2 = setTimeout(() => {
      let onboarded = false
      try { onboarded = localStorage.getItem(ONBOARDED_KEY) === '1' } catch {}
      const onLogin = window.location.pathname.startsWith('/login')
      setPhase(!onboarded && (onLogin || forced) ? 'onboarding' : 'done')
    }, SPLASH_MS + 450)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Ушли со страницы входа (вошли) — онбординг больше не нужен
  useEffect(() => {
    if (phase === 'onboarding' && !pathname.startsWith('/login')) finish()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  function finish() {
    try { localStorage.setItem(ONBOARDED_KEY, '1') } catch {}
    setPhase('done')
  }

  function next() {
    haptic('LIGHT')
    if (slide < SLIDES.length - 1) setSlide(s => s + 1)
    else finish()
  }

  if (phase === 'idle' || phase === 'done') return null

  if (phase === 'splash' || phase === 'out') {
    return (
      <div className={`splash${phase === 'out' ? ' splash--out' : ''}`} aria-hidden>
        <div className="brand-orbs">
          <div className="brand-orb brand-orb--a" />
          <div className="brand-orb brand-orb--b" />
          <div className="brand-orb brand-orb--c" />
        </div>
        <div className="splash__mark">
          <svg viewBox="0 0 512 512" fill="none" stroke="#04121C" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round">
            <path className="splash__one" d="M166 214 L222 158 V378" />
            <path className="splash__arc splash__arc--1" d="M280 172 a74 74 0 0 1 74 74" />
            <path className="splash__arc splash__arc--2" d="M280 100 a146 146 0 0 1 146 146" />
          </svg>
        </div>
        <div className="splash__name wordmark">Bir<em>Tap</em>Card</div>
        <div className="splash__tag">одно касание — один отзыв</div>
        <div className="splash__bar"><span /></div>
      </div>
    )
  }

  const s = SLIDES[slide]
  return (
    <div
      className="onb"
      role="dialog"
      aria-label="Знакомство с приложением"
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (dx < -50 && slide < SLIDES.length - 1) setSlide(v => v + 1)
        if (dx > 50 && slide > 0) setSlide(v => v - 1)
      }}
    >
      <div className="brand-orbs">
        <div className="brand-orb brand-orb--a" />
        <div className="brand-orb brand-orb--b" />
        <div className="brand-orb brand-orb--c" />
      </div>

      <div className="onb__top">
        <span className="wordmark" style={{ fontSize: 15 }}>Bir<em>Tap</em>Card</span>
        <button className="onb__skip" onClick={finish}>Пропустить</button>
      </div>

      <div className="onb__body" key={slide}>
        <div className="onb__icon" style={{ ['--onb-accent' as string]: s.accent }}>
          <Icon name={s.icon} size={40} strokeWidth={1.6} />
        </div>
        <h1 className="onb__title">{s.title}</h1>
        <p className="onb__text">{s.text}</p>
      </div>

      <div className="onb__foot">
        <div className="onb__dots">
          {SLIDES.map((_, i) => <span key={i} className={i === slide ? 'is-on' : ''} />)}
        </div>
        <button className="btn btn--primary onb__next" onClick={next}>
          {slide < SLIDES.length - 1 ? 'Далее' : 'Начать'}
          <Icon name="arrowRight" size={16} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
