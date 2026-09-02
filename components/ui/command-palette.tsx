'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Icon, type IconName } from './icons'
import { Portal } from './kit'
import { useTheme } from './theme'
import { flatNav, requestRefresh } from '../nav-config'

type Cmd = {
  id: string
  label: string
  hint?: string
  group: string
  icon: IconName
  keywords?: string
  run: () => void
}

type BranchLite = { id: string; name: string; companies?: { name: string } | null }
type CompanyLite = { id: string; name: string }

export function CommandPalette({
  open, onClose, role, onLogout,
}: {
  open: boolean
  onClose: () => void
  role: string | null
  onLogout: () => void
}) {
  const router = useRouter()
  const { resolved, toggle } = useTheme()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [branches, setBranches] = useState<BranchLite[]>([])
  const [companies, setCompanies] = useState<CompanyLite[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  // Данные подгружаются один раз при первом открытии
  useEffect(() => {
    if (!open || branches.length > 0) return
    const supabase = createClient()
    supabase.from('branches').select('id, name, companies(name)').order('name').limit(200)
      .then(({ data }) => setBranches((data as unknown as BranchLite[] | null) ?? []))
    if (role === 'super_admin') {
      supabase.from('companies').select('id, name').order('name').limit(100)
        .then(({ data }) => setCompanies((data as CompanyLite[] | null) ?? []))
    }
  }, [open, role, branches.length])

  useEffect(() => {
    if (open) { setQuery(''); setCursor(0) }
  }, [open])

  const commands = useMemo<Cmd[]>(() => {
    const go = (href: string) => () => { onClose(); router.push(href) }

    const nav: Cmd[] = flatNav(role).map(item => ({
      id: `nav:${item.href}`,
      label: item.label,
      hint: item.desc,
      group: 'Разделы',
      icon: item.icon,
      keywords: item.href,
      run: go(item.href),
    }))

    const actions: Cmd[] = [
      {
        id: 'act:theme',
        label: resolved === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему',
        group: 'Действия', icon: resolved === 'dark' ? 'sun' : 'moon',
        keywords: 'тема theme свет тьма dark light',
        run: () => { toggle(); onClose() },
      },
      {
        id: 'act:refresh',
        label: 'Обновить данные',
        group: 'Действия', icon: 'refresh',
        keywords: 'refresh обновить перезагрузить',
        run: () => { requestRefresh(); onClose() },
      },
      {
        id: 'act:logout',
        label: 'Выйти из аккаунта',
        group: 'Действия', icon: 'logout',
        keywords: 'logout выход выйти',
        run: () => { onClose(); onLogout() },
      },
    ]

    const branchCmds: Cmd[] = branches.map(b => ({
      id: `br:${b.id}`,
      label: b.name,
      hint: b.companies?.name ?? undefined,
      group: 'Филиалы',
      icon: 'branches',
      keywords: b.companies?.name ?? '',
      run: go(`/analytics?branch=${b.id}`),
    }))

    const companyCmds: Cmd[] = companies.map(c => ({
      id: `co:${c.id}`,
      label: c.name,
      group: 'Рестораны',
      icon: 'restaurants',
      run: go(`/branches?company=${c.id}`),
    }))

    return [...nav, ...actions, ...branchCmds, ...companyCmds]
  }, [role, branches, companies, resolved, router, toggle, onClose, onLogout])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands.slice(0, 24)
    return commands
      .filter(c => `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''}`.toLowerCase().includes(q))
      .slice(0, 30)
  }, [commands, query])

  useEffect(() => { setCursor(0) }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
      else if (e.key === 'Enter') { e.preventDefault(); filtered[cursor]?.run() }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, filtered, cursor, onClose])

  useEffect(() => {
    listRef.current?.querySelector('.cmdk__item--active')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  let lastGroup = ''

  return (
    <Portal>
      <div className="cmdk-root" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="cmdk" role="dialog" aria-modal="true" aria-label="Командная палитра">
          <div className="cmdk__search">
            <Icon name="search" size={18} style={{ color: 'var(--text-muted)' }} />
            <input
              className="cmdk__input"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск разделов, филиалов, действий…"
              aria-label="Поиск"
            />
            <span className="kbd">ESC</span>
          </div>

          <div className="cmdk__list" ref={listRef}>
            {filtered.length === 0 && (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Ничего не найдено
              </div>
            )}
            {filtered.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null
              lastGroup = c.group
              return (
                <div key={c.id}>
                  {header && <div className="cmdk__group">{header}</div>}
                  <button
                    className={`cmdk__item${i === cursor ? ' cmdk__item--active' : ''}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={c.run}
                  >
                    <Icon name={c.icon} size={16} />
                    <span className="truncate">{c.label}</span>
                    {c.hint && <span className="cmdk__meta truncate">{c.hint}</span>}
                  </button>
                </div>
              )
            })}
          </div>

          <div className="cmdk__foot">
            <span><span className="kbd">↑</span> <span className="kbd">↓</span> навигация</span>
            <span><span className="kbd">⏎</span> открыть</span>
            <span style={{ marginLeft: 'auto' }}>BirTapCard</span>
          </div>
        </div>
      </div>
    </Portal>
  )
}

/** Глобальный хоткей ⌘K / Ctrl+K */
export function useCommandHotkey(onOpen: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpen()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onOpen])
}
