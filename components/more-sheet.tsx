'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/icons'
import { Avatar, Modal, roleLabel } from '@/components/ui/kit'
import { useTheme } from '@/components/ui/theme'
import type { NavItem } from '@/components/nav-config'

/**
 * Меню «Ещё» для телефона: шторка снизу вместо бокового ящика.
 * Профиль → плитки разделов, которых нет в нижней навигации → тема, поиск, выход.
 */
export function MoreSheet({
  items, name, role, onClose, onSearch, onLogout,
}: {
  items: NavItem[]
  name?: string | null
  role: string | null
  onClose: () => void
  onSearch: () => void
  onLogout: () => void
}) {
  const pathname = usePathname()
  const { resolved, toggle } = useTheme()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <Modal title="Ещё" sub="Разделы и настройки" onClose={onClose}>
      <div className="more">
        <div className="more__profile">
          <Avatar name={name} role={role ?? undefined} size={42} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontSize: 14.5, fontWeight: 650 }}>{name || 'Без имени'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--mint)', fontWeight: 600 }}>{roleLabel(role)}</div>
          </div>
          <Link href="/settings" className="icon-btn" aria-label="Настройки" onClick={onClose}>
            <Icon name="settings" size={17} />
          </Link>
        </div>

        <div className="more__grid">
          {items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`more__tile${isActive(item.href) ? ' more__tile--active' : ''}`}
            >
              <span className="more__icon"><Icon name={item.icon} size={19} /></span>
              <span>{item.label}</span>
            </Link>
          ))}
          <button className="more__tile" onClick={() => { onClose(); onSearch() }}>
            <span className="more__icon"><Icon name="search" size={19} /></span>
            <span>Поиск</span>
          </button>
          <button className="more__tile" onClick={toggle}>
            <span className="more__icon"><Icon name={resolved === 'dark' ? 'sun' : 'moon'} size={19} /></span>
            <span>{resolved === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
          </button>
        </div>

        <button className="more__logout" onClick={onLogout}>
          <Icon name="logout" size={16} /> Выйти из аккаунта
        </button>

        <div className="more__foot">
          <span className="wordmark" style={{ fontSize: 12.5 }}>Bir<em>Tap</em>Card</span>
          <span>одно касание — один отзыв</span>
        </div>
      </div>
    </Modal>
  )
}
