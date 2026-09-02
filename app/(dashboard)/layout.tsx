'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { clearProfileCache, useProfile } from '@/lib/hooks'
import { Icon, Logo } from '@/components/ui/icons'
import { Avatar, IconButton, roleLabel } from '@/components/ui/kit'
import { ThemeToggle } from '@/components/ui/theme'
import { CommandPalette, useCommandHotkey } from '@/components/ui/command-palette'
import { getNavByRole, flatNav, PAGE_META, requestRefresh } from '@/components/nav-config'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, role, loaded } = useProfile()

  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const [time, setTime] = useState('')
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const navGroups = getNavByRole(role)
  const navItems = flatNav(role)
  const meta = PAGE_META[pathname] ?? { title: 'BirTapCard', sub: '' }

  // Неавторизованных отправляем на вход
  useEffect(() => {
    if (loaded && !profile) router.push('/login')
  }, [loaded, profile, router])

  // Часы в шапке
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [])

  // Меню закрывается при переходе
  useEffect(() => { setDrawer(false) }, [pathname])

  // Блокировка прокрутки под открытым меню
  useEffect(() => {
    if (!drawer) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [drawer])

  useCommandHotkey(useCallback(() => setPalette(true), []))

  // Потяните вниз, чтобы обновить (мобильные)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(hover: none)').matches) return

    let startY: number | null = null
    let current = 0
    const THRESHOLD = 68

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 4 || e.touches.length !== 1) { startY = null; return }
      startY = e.touches[0].clientY
    }
    const onMove = (e: TouchEvent) => {
      if (startY === null) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || window.scrollY > 4) { current = 0; setPull(0); return }
      current = Math.min(dy * 0.42, 84)
      setPull(current)
    }
    const onEnd = () => {
      if (startY === null) return
      startY = null
      const reached = current >= THRESHOLD
      current = 0
      setPull(0)
      if (reached) {
        setRefreshing(true)
        requestRefresh()
        if ('vibrate' in navigator) { try { navigator.vibrate(12) } catch {} }
        setTimeout(() => setRefreshing(false), 900)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  const handleLogout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearProfileCache()
    router.push('/login')
  }, [router])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Нижняя навигация: до 4 разделов + «Ещё»
  const quick = navItems.length > 5 ? navItems.slice(0, 4) : navItems
  const showMore = navItems.length > quick.length

  return (
    <div className="shell">

      {/* ── Боковое меню ─────────────────────────────────────────────── */}
      <aside className={`sidebar${drawer ? ' sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <Logo size={38} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.02em' }}>BirTapCard</div>
            <div style={{ fontSize: 9.5, color: 'var(--mint)', fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              Аналитика
            </div>
          </div>
          <div className="only-mobile">
            <IconButton icon="close" title="Закрыть меню" small onClick={() => setDrawer(false)} />
          </div>
        </div>

        <nav className="sidebar__nav">
          {navGroups.map(group => (
            <div className="nav-group" key={group.group}>
              <div className="nav-group__label">{group.group}</div>
              {group.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link${isActive(item.href) ? ' nav-link--active' : ''}`}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}

          <div className="nav-group mobile-block">
            <div className="nav-group__label">Интерфейс</div>
            <button
              className="nav-link"
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { setDrawer(false); setPalette(true) }}
            >
              <Icon name="search" size={17} />
              <span>Быстрый поиск</span>
            </button>
          </div>
        </nav>

        <div className="sidebar__foot">
          <div className="row" style={{ padding: 9, borderRadius: 'var(--r-md)', background: 'var(--card)', border: '1px solid var(--border-soft)' }}>
            <Avatar name={profile?.full_name} role={role ?? undefined} size={34} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="truncate" style={{ fontSize: 12.5, fontWeight: 650 }}>
                {profile?.full_name ?? (loaded ? 'Без имени' : '…')}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--mint)', fontWeight: 600 }}>{roleLabel(role)}</div>
            </div>
            <IconButton icon="logout" title="Выйти" small danger onClick={handleLogout} />
          </div>
        </div>
      </aside>

      {drawer && <div className="backdrop" onClick={() => setDrawer(false)} />}

      {/* ── Основная область ─────────────────────────────────────────── */}
      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn only-mobile"
            onClick={() => setDrawer(true)}
            aria-label="Открыть меню"
          >
            <Icon name="menu" size={18} />
          </button>

          <div style={{ minWidth: 0 }}>
            <h1 className="topbar__title truncate">{meta.title}</h1>
            {meta.sub && <div className="topbar__sub">{meta.sub}</div>}
          </div>

          <div className="topbar__actions">
            <button
              className="btn btn--ghost only-desktop"
              onClick={() => setPalette(true)}
              style={{ gap: 9, paddingRight: 9, color: 'var(--text-muted)', fontWeight: 500 }}
            >
              <Icon name="search" size={15} />
              Поиск
              <span className="kbd" style={{ marginLeft: 4 }}>⌘K</span>
            </button>

            <button
              className="icon-btn only-mobile"
              onClick={() => setPalette(true)}
              aria-label="Поиск"
            >
              <Icon name="search" size={17} />
            </button>

            <div
              className="mono only-desktop"
              style={{
                display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 12px',
                borderRadius: 'var(--r-sm)', background: 'var(--card2)',
                border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-dim)',
              }}
            >
              <span className="live-dot" />
              {time}
            </div>

            <button
              className="icon-btn"
              onClick={() => {
                setRefreshing(true)
                requestRefresh()
                setTimeout(() => setRefreshing(false), 800)
              }}
              aria-label="Обновить данные"
              title="Обновить данные"
            >
              <Icon name="refresh" size={16} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
            </button>

            <ThemeToggle />
          </div>
        </header>

        {/* Индикатор «потяните, чтобы обновить» */}
        {(pull > 0 || refreshing) && (
          <div
            className="pull-hint only-mobile"
            style={{ height: refreshing ? 44 : pull, justifyContent: 'center' }}
          >
            {refreshing ? (
              <><span className="spinner" /> Обновляем…</>
            ) : (
              <>
                <Icon
                  name="arrowDown"
                  size={14}
                  style={{ transform: pull >= 68 ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
                />
                {pull >= 68 ? 'Отпустите для обновления' : 'Потяните вниз'}
              </>
            )}
          </div>
        )}

        <main className="content">{children}</main>
      </div>

      {/* ── Нижняя навигация (мобильные) ─────────────────────────────── */}
      <nav className="bottom-nav">
        {quick.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav__item${isActive(item.href) ? ' bottom-nav__item--active' : ''}`}
          >
            <Icon name={item.icon} size={19} />
            {item.label}
          </Link>
        ))}
        {showMore && (
          <button
            className={`bottom-nav__item${drawer ? ' bottom-nav__item--active' : ''}`}
            onClick={() => setDrawer(true)}
          >
            <Icon name="more" size={19} />
            Ещё
          </button>
        )}
      </nav>

      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        role={role}
        onLogout={handleLogout}
      />
    </div>
  )
}
