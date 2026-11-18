'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Icon, Logo, type IconName } from '@/components/ui/icons'
import type { RestaurantRole } from '@/lib/restaurant/types'

const navigation: { section: string; label: string; icon: IconName }[] = [
  { section: 'orders', label: 'Заказы', icon: 'dashboard' },
  { section: 'kitchen', label: 'Кухня', icon: 'clock' },
  { section: 'menu', label: 'Меню', icon: 'restaurants' },
  { section: 'tables', label: 'Столы и QR', icon: 'qrcodes' },
  { section: 'feedback', label: 'Отзывы гостей', icon: 'star' },
  { section: 'team', label: 'Команда', icon: 'users' },
]

const roleNames: Record<RestaurantRole, string> = {
  restaurant_admin: 'Администратор ресторана',
  staff: 'Сотрудник зала',
  kitchen: 'Кухня',
  super_admin: 'Суперадминистратор',
}

export default function RestaurantAdminShell({
  children,
  restaurantId,
  restaurantName,
  role,
}: {
  children: React.ReactNode
  restaurantId: string
  restaurantName: string
  role: RestaurantRole
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const activeSection = pathname.split('/').at(-1) ?? 'orders'
  const activeItem = navigation.find((item) => item.section === activeSection)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [drawerOpen])

  return (
    <div className="shell ra-shell">
      <aside className={'sidebar ra-sidebar' + (drawerOpen ? ' sidebar--open' : '')}>
        <Link href="/restaurant-admin" className="sidebar__brand ra-sidebar-brand">
          <Logo size={38} />
          <span className="ra-brand-copy">
            <strong>BirTapCard</strong>
            <small>Ресторанный сервис</small>
          </span>
        </Link>

        <nav className="sidebar__nav" aria-label="Разделы ресторана">
          <div className="nav-group">
            <div className="nav-group__label">Рабочее место</div>
            {navigation.map((item) => {
              const href = '/restaurant-admin/' + restaurantId + '/' + item.section
              const isActive = pathname === href
              return (
                <Link
                  key={item.section}
                  href={href}
                  className={'nav-link' + (isActive ? ' nav-link--active' : '')}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        <div className="sidebar__foot ra-sidebar-foot">
          <div className="ra-venue-chip">
            <span className="ra-venue-indicator" aria-hidden="true" />
            <span>
              <strong>{restaurantName}</strong>
              <small>{roleNames[role]}</small>
            </span>
          </div>
          {role === 'super_admin' && (
            <Link className="nav-link" href="/restaurant-admin/platform">
              <Icon name="layers" size={17} />
              <span>Вся сеть</span>
            </Link>
          )}
          <Link className="nav-link" href="/dashboard">
            <Icon name="analytics" size={17} />
            <span>Аналитика BirTapCard</span>
          </Link>
        </div>
      </aside>

      {drawerOpen && <button className="backdrop ra-backdrop" aria-label="Закрыть меню" onClick={() => setDrawerOpen(false)} />}

      <div className="main">
        <header className="topbar ra-topbar">
          <button className="icon-btn only-mobile" onClick={() => setDrawerOpen(true)} aria-label="Открыть меню ресторана">
            <Icon name="menu" size={18} />
          </button>
          <div className="ra-topbar-heading">
            <div className="topbar__title truncate">{restaurantName}</div>
            <div className="topbar__sub">{activeItem?.label ?? 'Ресторанный сервис'}</div>
          </div>
          <div className="topbar__actions">
            {role === 'super_admin' && (
              <Link href="/restaurant-admin/platform" className="btn btn--ghost ra-topbar-action">
                <Icon name="layers" size={16} />
                Вся сеть
              </Link>
            )}
            <Link href="/dashboard" className="btn btn--ghost ra-topbar-action">
              <Icon name="analytics" size={16} />
              Аналитика
            </Link>
          </div>
        </header>
        <div className="content ra-content">{children}</div>
      </div>
    </div>
  )
}
