import type { IconName } from './ui/icons'

export type NavItem = { href: string; label: string; icon: IconName; desc: string }
export type NavGroup = { group: string; items: NavItem[] }

/**
 * Доступ по ролям (совпадает с lib/permissions.ts и middleware):
 * super_admin — всё; owner и branch_manager — только дашборд и аналитика.
 */

const ANALYTICS: NavItem[] = [
  { href: '/dashboard', label: 'Дашборд',  icon: 'dashboard', desc: 'Общая статистика по сканированиям' },
  { href: '/analytics', label: 'Аналитика', icon: 'analytics', desc: 'Детальная аналитика сканирований' },
]

export const SUPER_ADMIN_NAV: NavGroup[] = [
  { group: 'Главная', items: ANALYTICS },
  {
    group: 'Управление',
    items: [
      { href: '/companies', label: 'Рестораны',     icon: 'restaurants', desc: 'Управление сетью ресторанов' },
      { href: '/branches',  label: 'Филиалы',       icon: 'branches',    desc: 'Точки и NFC/QR-токены' },
      { href: '/qrcodes',   label: 'QR-коды',       icon: 'qrcodes',     desc: 'Просмотр и скачивание QR' },
      { href: '/users',     label: 'Пользователи',  icon: 'users',       desc: 'Доступ и роли сотрудников' },
    ],
  },
  {
    group: 'Инструменты',
    items: [
      { href: '/telegram', label: 'Telegram',  icon: 'telegram', desc: 'Уведомления в Telegram' },
      { href: '/settings', label: 'Настройки', icon: 'settings', desc: 'Профиль и безопасность' },
    ],
  },
]

export const READONLY_NAV: NavGroup[] = [
  { group: 'Аналитика', items: ANALYTICS },
]

export function getNavByRole(role: string | null): NavGroup[] {
  return role === 'super_admin' ? SUPER_ADMIN_NAV : READONLY_NAV
}

export function flatNav(role: string | null): NavItem[] {
  return getNavByRole(role).flatMap(g => g.items)
}

export const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/dashboard': { title: 'Дашборд',      sub: 'Общая статистика по сканированиям' },
  '/analytics': { title: 'Аналитика',    sub: 'Детальная аналитика сканирований' },
  '/companies': { title: 'Рестораны',    sub: 'Управление сетью ресторанов' },
  '/branches':  { title: 'Филиалы',      sub: 'Управление точками и NFC/QR-токенами' },
  '/qrcodes':   { title: 'QR-коды',      sub: 'Просмотр и скачивание QR-кодов' },
  '/users':     { title: 'Пользователи', sub: 'Доступ и роли сотрудников' },
  '/telegram':  { title: 'Telegram',     sub: 'Уведомления в Telegram' },
  '/settings':  { title: 'Настройки',    sub: 'Профиль и безопасность' },
}

/** Событие «обновить данные» — палитра команд и кнопка в шапке дергают его. */
export const REFRESH_EVENT = 'btc:refresh'

export function requestRefresh() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REFRESH_EVENT))
}
