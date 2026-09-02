'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Icon } from './icons'

type ThemeMode = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'btc-theme'

/** Скрипт, который ставит тему до первой отрисовки — без «мигания» белым. */
export const themeInitScript = `
(function(){try{
  var t = localStorage.getItem('${STORAGE_KEY}') || 'dark';
  var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();
`

type ThemeCtx = { mode: ThemeMode; resolved: 'dark' | 'light'; setMode: (m: ThemeMode) => void; toggle: () => void }

const Ctx = createContext<ThemeCtx>({ mode: 'dark', resolved: 'dark', setMode: () => {}, toggle: () => {} })

export function useTheme() { return useContext(Ctx) }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark')
  const [resolved, setResolved] = useState<'dark' | 'light'>('dark')

  const apply = useCallback((m: ThemeMode) => {
    const prefersDark = typeof window !== 'undefined'
      && window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = m === 'dark' || (m === 'system' && prefersDark)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    setResolved(dark ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    let saved: ThemeMode = 'dark'
    try { saved = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'dark' } catch {}
    setModeState(saved)
    apply(saved)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { if (saved === 'system') apply('system') }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [apply])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    try { localStorage.setItem(STORAGE_KEY, m) } catch {}
    apply(m)
  }, [apply])

  const toggle = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved, setMode])

  return <Ctx.Provider value={{ mode, resolved, setMode, toggle }}>{children}</Ctx.Provider>
}

export function ThemeToggle({ className = 'icon-btn' }: { className?: string }) {
  const { resolved, toggle } = useTheme()
  return (
    <button
      className={className}
      onClick={toggle}
      title={resolved === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      aria-label="Переключить тему"
    >
      <Icon name={resolved === 'dark' ? 'sun' : 'moon'} size={16} />
    </button>
  )
}
