'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Icon } from './icons'

type ToastKind = 'success' | 'error' | 'info'
type Toast = { id: number; kind: ToastKind; title: string; desc?: string; leaving?: boolean }

type ToastCtx = {
  toast: (title: string, opts?: { kind?: ToastKind; desc?: string; duration?: number }) => void
  success: (title: string, desc?: string) => void
  error: (title: string, desc?: string) => void
}

const Ctx = createContext<ToastCtx>({ toast: () => {}, success: () => {}, error: () => {} })

export function useToast() { return useContext(Ctx) }

let seq = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>[]>>({})

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)))
    const t = setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), 220)
    timers.current[id] = [...(timers.current[id] ?? []), t]
  }, [])

  const toast = useCallback<ToastCtx['toast']>((title, opts) => {
    const id = ++seq
    const duration = opts?.duration ?? 3400
    setItems(prev => [...prev.slice(-3), { id, kind: opts?.kind ?? 'info', title, desc: opts?.desc }])
    const t = setTimeout(() => dismiss(id), duration)
    timers.current[id] = [t]
    // Лёгкая тактильная отдача на мобильных
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(opts?.kind === 'error' ? [14, 40, 14] : 10) } catch {}
    }
  }, [dismiss])

  const success = useCallback((title: string, desc?: string) => toast(title, { kind: 'success', desc }), [toast])
  const error = useCallback((title: string, desc?: string) => toast(title, { kind: 'error', desc, duration: 5000 }), [toast])

  useEffect(() => {
    const map = timers.current
    return () => { Object.values(map).flat().forEach(clearTimeout) }
  }, [])

  return (
    <Ctx.Provider value={{ toast, success, error }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={`toast toast--${t.kind}${t.leaving ? ' toast--out' : ''}`}>
            <span className="toast__icon">
              <Icon name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'} size={17} strokeWidth={2.1} />
            </span>
            <div className="toast__text">
              <div className="toast__title">{t.title}</div>
              {t.desc && <div className="toast__desc">{t.desc}</div>}
            </div>
            <button
              className="search__clear"
              style={{ position: 'static', translate: 'none', flexShrink: 0 }}
              onClick={() => dismiss(t.id)}
              aria-label="Закрыть"
            >
              <Icon name="close" size={12} strokeWidth={2.4} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
