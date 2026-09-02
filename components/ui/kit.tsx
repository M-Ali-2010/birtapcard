'use client'

import {
  createContext, useCallback, useContext, useEffect, useId,
  useMemo, useRef, useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './icons'
import { useToast } from './toast'

/* ─── Портал ──────────────────────────────────────────────────────────────── */

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

/* ─── Панель ──────────────────────────────────────────────────────────────── */

export function Panel({
  title, sub, action, children, className = '', style, id,
}: {
  title?: React.ReactNode
  sub?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  id?: string
}) {
  return (
    <section className={`panel ${className}`} style={style} id={id}>
      {(title || action) && (
        <header className="panel__head">
          <div style={{ minWidth: 0 }}>
            {title && <h2 className="panel__title">{title}</h2>}
            {sub && <div className="panel__sub">{sub}</div>}
          </div>
          {action && <div className="panel__action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/* ─── Кнопки ──────────────────────────────────────────────────────────────── */

type Variant = 'primary' | 'ghost' | 'outline' | 'danger'

export function Button({
  children, onClick, variant = 'ghost', size, disabled, loading, type = 'button',
  icon, block, title, className = '',
}: {
  children?: React.ReactNode
  onClick?: () => void
  variant?: Variant
  size?: 'sm'
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  icon?: IconName
  block?: boolean
  title?: string
  className?: string
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn--${variant}${size === 'sm' ? ' btn--sm' : ''}${block ? ' btn--block' : ''} ${className}`}
    >
      {loading ? <span className="spinner" style={{ width: 15, height: 15 }} /> : icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon, onClick, title, danger, small, active, disabled, children,
}: {
  icon?: IconName
  onClick?: () => void
  title: string
  danger?: boolean
  small?: boolean
  active?: boolean
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`icon-btn${small ? ' icon-btn--sm' : ''}${danger ? ' icon-btn--danger' : ''}`}
      style={active ? { color: 'var(--mint)', borderColor: 'color-mix(in srgb, var(--mint) 45%, transparent)', background: 'var(--mint-dim)' } : undefined}
    >
      {children ?? (icon && <Icon name={icon} size={small ? 15 : 17} />)}
    </button>
  )
}

/* ─── Поля ────────────────────────────────────────────────────────────────── */

export function Field({
  label, hint, error, children,
}: {
  label: string; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div className="field">
      <label className="field__label">{label}</label>
      {children}
      {error ? <div className="field__error">{error}</div> : hint ? <div className="field__hint">{hint}</div> : null}
    </div>
  )
}

export function SearchInput({
  value, onChange, placeholder = 'Поиск…', autoFocus,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean
}) {
  return (
    <div className="search">
      <span className="search__icon"><Icon name="search" size={15} /></span>
      <input
        className="input"
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        type="search"
        enterKeyHint="search"
      />
      {value && (
        <button className="search__clear" onClick={() => onChange('')} aria-label="Очистить">
          <Icon name="close" size={11} strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}

export function Switch({
  checked, onChange, disabled, label,
}: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string
}) {
  const btn = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? 'Переключить'}
      disabled={disabled}
      onClick={e => { e.stopPropagation(); onChange(!checked) }}
      className="switch"
    />
  )
  if (!label) return btn
  return (
    <div className="switch-row" onClick={() => !disabled && onChange(!checked)} role="presentation">
      <span className="switch-row__text">{label}</span>
      {btn}
    </div>
  )
}

export function Segmented<T extends string>({
  value, onChange, options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map(o => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={`segmented__item${value === o.value ? ' segmented__item--active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ─── Бейджи ──────────────────────────────────────────────────────────────── */

export function Badge({
  children, tone = 'muted', dot,
}: {
  children: React.ReactNode
  tone?: 'mint' | 'orange' | 'blue' | 'purple' | 'danger' | 'success' | 'muted'
  dot?: boolean
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="dot" style={{ background: 'currentColor' }} />}
      {children}
    </span>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'mint' : 'danger'} dot>{active ? 'Активен' : 'Отключен'}</Badge>
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  owner: 'Владелец',
  branch_manager: 'Менеджер',
}
const ROLE_TONE: Record<string, 'purple' | 'mint' | 'blue'> = {
  super_admin: 'purple',
  owner: 'mint',
  branch_manager: 'blue',
}
const ROLE_COLOR: Record<string, string> = {
  super_admin: 'var(--purple)',
  owner: 'var(--mint)',
  branch_manager: 'var(--blue)',
}
const ROLE_DIM: Record<string, string> = {
  super_admin: 'var(--purple-dim)',
  owner: 'var(--mint-dim)',
  branch_manager: 'var(--blue-dim)',
}

export function roleLabel(role: string | null | undefined) {
  return ROLE_LABEL[role ?? ''] ?? role ?? '—'
}

export function RoleBadge({ role }: { role: string }) {
  return <Badge tone={ROLE_TONE[role] ?? 'muted'}>{ROLE_LABEL[role] ?? role}</Badge>
}

export function Avatar({ name, role, size = 36 }: { name?: string | null; role?: string; size?: number }) {
  const initials = (name || '?')
    .split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const color = ROLE_COLOR[role ?? ''] ?? 'var(--mint)'
  const bg = ROLE_DIM[role ?? ''] ?? 'var(--mint-dim)'
  return (
    <div
      className="avatar"
      style={{
        width: size, height: size, background: bg, color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        fontSize: size * 0.34,
      }}
    >
      {initials}
    </div>
  )
}

/* ─── Загрузка / пустое состояние ─────────────────────────────────────────── */

export function Skeleton({ h = 14, w = '100%', r, style }: { h?: number | string; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />
}

export function SkeletonRows({ rows = 5, height = 52 }: { rows?: number; height?: number }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} h={height} r={12} style={{ opacity: 1 - i * 0.11 }} />
      ))}
    </div>
  )
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi" style={{ minHeight: 108 }}>
          <div className="kpi__top">
            <Skeleton w={92} h={10} />
            <Skeleton w={32} h={32} r={9} />
          </div>
          <Skeleton w={72} h={26} style={{ marginBottom: 10 }} />
          <Skeleton w={110} h={9} />
        </div>
      ))}
    </>
  )
}

export function EmptyState({
  icon = 'search', title, text, action,
}: {
  icon?: IconName; title: string; text?: string; action?: React.ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty__icon"><Icon name={icon} size={24} /></div>
      <div className="empty__title">{title}</div>
      {text && <p className="empty__text">{text}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

export function AccessDenied({ what }: { what: string }) {
  return (
    <Panel>
      <EmptyState
        icon="lock"
        title="Доступ ограничен"
        text={`Раздел «${what}» доступен только для роли Super Admin.`}
      />
    </Panel>
  )
}

export function LoadingScreen({ text = 'Загрузка…' }: { text?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: '48vh' }}>
      <span className="spinner spinner--lg" />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</span>
    </div>
  )
}

/* ─── Модальное окно (на мобильных — нижняя шторка) ───────────────────────── */

export function Modal({
  onClose, title, sub, children, footer, width, icon,
}: {
  onClose: () => void
  title: React.ReactNode
  sub?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: 'narrow' | 'wide'
  icon?: IconName
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <Portal>
      <div className="modal-root" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className={`modal${width ? ` modal--${width}` : ''}`} role="dialog" aria-modal="true">
          <div className="modal__grip" />
          <header className="modal__head">
            {icon && (
              <span style={{
                width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center',
                background: 'var(--mint-dim)', color: 'var(--mint)', flexShrink: 0,
              }}>
                <Icon name={icon} size={18} />
              </span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="modal__title">{title}</div>
              {sub && <div className="modal__sub">{sub}</div>}
            </div>
            <IconButton icon="close" title="Закрыть" small onClick={onClose} />
          </header>
          <div className="modal__body">{children}</div>
          {footer && <footer className="modal__foot">{footer}</footer>}
        </div>
      </div>
    </Portal>
  )
}

/* ─── Диалог подтверждения (вместо window.confirm) ────────────────────────── */

type ConfirmOptions = {
  title: string
  text?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false)

export function useConfirm() { return useContext(ConfirmCtx) }

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>(resolve => setState({ opts, resolve }))
  }, [])

  const close = useCallback((value: boolean) => {
    setState(prev => { prev?.resolve(value); return null })
  }, [])

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          width="narrow"
          icon={state.opts.danger ? 'alert' : 'info'}
          title={state.opts.title}
          onClose={() => close(false)}
          footer={
            <>
              <Button onClick={() => close(false)}>{state.opts.cancelLabel ?? 'Отмена'}</Button>
              <Button
                variant={state.opts.danger ? 'danger' : 'primary'}
                onClick={() => close(true)}
              >
                {state.opts.confirmLabel ?? 'Подтвердить'}
              </Button>
            </>
          }
        >
          {state.opts.text && (
            <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.65, margin: '0 0 6px' }}>
              {state.opts.text}
            </p>
          )}
        </Modal>
      )}
    </ConfirmCtx.Provider>
  )
}

/* ─── Копирование значения ────────────────────────────────────────────────── */

export function CopyField({ value, label, compact }: { value: string; label?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    }
    setCopied(true)
    toast('Скопировано', { kind: 'success', desc: value.length > 46 ? value.slice(0, 46) + '…' : value })
    setTimeout(() => setCopied(false), 1600)
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function share() {
    try { await navigator.share({ title: label ?? 'BirTapCard', url: value }) } catch {}
  }

  return (
    <div>
      {label && (
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
          letterSpacing: 0.6, marginBottom: 5, fontWeight: 650,
        }}>
          {label}
        </div>
      )}
      <div className="copy">
        <div className="copy__value" title={value}>{value}</div>
        <IconButton
          small={compact}
          title="Скопировать"
          onClick={copy}
        >
          <Icon name={copied ? 'check' : 'copy'} size={14} style={copied ? { color: 'var(--mint)' } : undefined} />
        </IconButton>
        {canShare && (
          <IconButton small={compact} icon="share" title="Поделиться" onClick={share} />
        )}
      </div>
    </div>
  )
}

/* ─── Числа: плавный счётчик ──────────────────────────────────────────────── */

export function AnimatedNumber({
  value, suffix = '', duration = 700,
}: { value: number; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) { setDisplay(to); return }

    const reduce = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { fromRef.current = to; setDisplay(to); return }

    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (to - from) * eased)
      if (p < 1) rafRef.current = requestAnimationFrame(step)
      else fromRef.current = to
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  const isFloat = !Number.isInteger(value)
  const shown = isFloat ? display.toFixed(1) : Math.round(display).toLocaleString('ru-RU')
  return <>{shown}{suffix}</>
}

/* ─── Спарклайн ───────────────────────────────────────────────────────────── */

export function Sparkline({
  values, color = 'var(--mint)', height = 38,
}: { values: number[]; color?: string; height?: number }) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const path = useMemo(() => {
    const pts = values.length > 1 ? values : [0, 0]
    const max = Math.max(...pts, 1)
    const min = Math.min(...pts, 0)
    const span = max - min || 1
    const stepX = 100 / (pts.length - 1)
    const coords = pts.map((v, i) => [i * stepX, 100 - ((v - min) / span) * 88 - 6] as const)
    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    const area = `${line} L100,100 L0,100 Z`
    return { line, area }
  }, [values])

  return (
    <svg className="kpi__spark" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={`sp${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#sp${gid})`} />
      <path d={path.line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* ─── KPI-карточка ────────────────────────────────────────────────────────── */

export type Accent = 'mint' | 'orange' | 'blue' | 'purple'

const ACCENTS: Record<Accent, { color: string; dim: string }> = {
  mint:   { color: 'var(--mint)',   dim: 'var(--mint-dim)' },
  orange: { color: 'var(--orange)', dim: 'var(--orange-dim)' },
  blue:   { color: 'var(--blue)',   dim: 'var(--blue-dim)' },
  purple: { color: 'var(--purple)', dim: 'var(--purple-dim)' },
}

export function KpiCard({
  label, value, suffix, sub, delta, accent = 'mint', icon, spark, loading,
}: {
  label: string
  value: number | string
  suffix?: string
  sub?: React.ReactNode
  delta?: { value: number; label?: string }
  accent?: Accent
  icon: IconName
  spark?: number[]
  loading?: boolean
}) {
  const a = ACCENTS[accent]
  return (
    <article
      className="kpi"
      style={{ ['--kpi-accent' as string]: a.color, ['--kpi-dim' as string]: a.dim }}
    >
      {spark && spark.length > 1 && <Sparkline values={spark} color={a.color} />}
      <div className="kpi__top">
        <span className="kpi__label">{label}</span>
        <span className="kpi__icon"><Icon name={icon} size={16} /></span>
      </div>
      <div className="kpi__value">
        {loading ? <span style={{ opacity: 0.35 }}>—</span>
          : typeof value === 'number' ? <AnimatedNumber value={value} suffix={suffix ?? ''} />
          : value}
      </div>
      <div className="kpi__foot">
        {delta && (
          <span className={`delta delta--${delta.value > 0 ? 'up' : delta.value < 0 ? 'down' : 'flat'}`}>
            <Icon name={delta.value >= 0 ? 'arrowUp' : 'arrowDown'} size={11} strokeWidth={2.4} />
            {Math.abs(delta.value)}
          </span>
        )}
        {delta?.label && <span>{delta.label}</span>}
        {sub && <span className="truncate">{sub}</span>}
      </div>
    </article>
  )
}

/* ─── Плашка-уведомление ──────────────────────────────────────────────────── */

export function Note({
  tone = 'info', children, onClose, icon,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success'
  children: React.ReactNode
  onClose?: () => void
  icon?: IconName
}) {
  const defaultIcon: IconName = tone === 'danger' ? 'alert' : tone === 'warning' ? 'alert' : tone === 'success' ? 'check' : 'info'
  return (
    <div className={`note note--${tone}`}>
      <Icon name={icon ?? defaultIcon} size={16} style={{ marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2, opacity: 0.7 }}
        >
          <Icon name="close" size={14} strokeWidth={2.2} />
        </button>
      )}
    </div>
  )
}
