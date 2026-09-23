/**
 * app/api/admin/health/route.ts
 *
 * «Готовность системы» — одна страница правды о том, что уже работает,
 * а что ещё нужно донастроить: применены ли миграции, заданы ли ключи в
 * Vercel, стоит ли вебхук, приходят ли снимки отзывов, уходят ли отчёты.
 *
 * Значений секретов наружу не отдаём никогда — только «задан / не задан».
 * Доступ только super_admin: тут видно устройство всей платформы.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getWebhookInfo } from '@/lib/telegram/bot'

export const dynamic = 'force-dynamic'

type Level = 'ok' | 'warn' | 'fail'

interface Check {
  id: string
  label: string
  level: Level
  detail: string
  /** Что сделать, если не ок — текстом, без ссылок на секреты */
  fix?: string
}

async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
  return data?.role === 'super_admin'
}

function ago(iso: string | null): string {
  if (!iso) return 'никогда'
  const h = (Date.now() - new Date(iso).getTime()) / 3600000
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} мин назад`
  if (h < 48) return `${Math.round(h)} ч назад`
  return `${Math.round(h / 24)} дн назад`
}

export async function GET(_req: NextRequest) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceRoleClient()
  const checks: Check[] = []

  // ─── Миграция 0004: таблица заявок ─────────────────────────────────────────
  const leadsProbe = await db.from('leads').select('id', { count: 'exact', head: true })
  const leadsMissing = leadsProbe.error?.code === '42P01'
  if (leadsMissing) {
    checks.push({
      id: 'migration_leads', label: 'Таблица заявок (leads)', level: 'fail',
      detail: 'Таблицы нет — заявки из бота сохраняться не будут',
      fix: 'Выполните 0004_leads.sql в Supabase → SQL Editor',
    })
  } else {
    const { count: newLeads } = await db.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new')
    checks.push({
      id: 'migration_leads', label: 'Таблица заявок (leads)', level: 'ok',
      detail: `Готова · новых заявок: ${newLeads ?? 0}`,
    })
  }

  // ─── Миграция 0005: час отправки отчёта ────────────────────────────────────
  const hourProbe = await db.from('telegram_settings').select('report_hour').limit(1)
  const hourMissing = hourProbe.error?.code === '42703'
  checks.push(hourMissing
    ? {
        id: 'migration_report_hour', label: 'Время отчёта (report_hour)', level: 'fail',
        detail: 'Колонки нет — отчёт не сможет уйти',
        fix: 'Выполните 0005_report_time.sql в Supabase → SQL Editor',
      }
    : { id: 'migration_report_hour', label: 'Время отчёта (report_hour)', level: 'ok', detail: 'Готово' })

  // ─── Миграция 0006: поддержка и уведомления об отзывах ─────────────────────
  const supProbe = await db.from('support_messages').select('id', { count: 'exact', head: true })
  if (supProbe.error?.code === '42P01') {
    checks.push({
      id: 'migration_support', label: 'Поддержка в боте', level: 'fail',
      detail: 'Таблицы support_messages нет — обращения не сохранятся',
      fix: 'Выполните 0006_support_and_alerts.sql в Supabase → SQL Editor',
    })
  } else {
    const { count: open } = await db.from('support_messages').select('id', { count: 'exact', head: true }).eq('status', 'new')
    checks.push({
      id: 'migration_support', label: 'Поддержка в боте', level: 'ok',
      detail: `Готова · без ответа: ${open ?? 0}`,
    })
  }

  // ─── Ключи в Vercel: только факт наличия ───────────────────────────────────
  const env: [string, string, boolean, string][] = [
    ['TELEGRAM_BOT_TOKEN', 'Токен бота', !!process.env.TELEGRAM_BOT_TOKEN, 'Без него бот не отвечает вообще'],
    ['CRON_SECRET', 'Секрет крона', !!process.env.CRON_SECRET, 'Без него ежедневные отчёты не отправляются'],
    ['GOOGLE_PLACES_API_KEY', 'Ключ Google Places', !!process.env.GOOGLE_PLACES_API_KEY, 'Без него не считаются реальные отзывы'],
    ['TELEGRAM_WEBHOOK_SECRET', 'Секрет вебхука', !!process.env.TELEGRAM_WEBHOOK_SECRET, 'Желателен: без него вебхук принимает запросы от кого угодно'],
  ]
  for (const [key, label, present, why] of env) {
    const optional = key === 'TELEGRAM_WEBHOOK_SECRET'
    checks.push({
      id: `env_${key}`, label,
      level: present ? 'ok' : (optional ? 'warn' : 'fail'),
      detail: present ? 'Задан' : why,
      fix: present ? undefined : `Добавьте ${key} в Vercel → Settings → Environment Variables и сделайте Redeploy`,
    })
  }

  // ─── Вебхук Telegram ───────────────────────────────────────────────────────
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const info = await getWebhookInfo()
      const url = info?.url ?? ''
      checks.push({
        id: 'webhook', label: 'Вебхук Telegram',
        level: url ? 'ok' : 'fail',
        detail: url
          ? `Подключён${info?.last_error_message ? ` · последняя ошибка: ${info.last_error_message}` : ''}`
          : 'Не подключён — бот не получает сообщения',
        fix: url ? undefined : 'Нажмите «Подключить бота» на этой странице',
      })
    } catch {
      checks.push({ id: 'webhook', label: 'Вебхук Telegram', level: 'warn', detail: 'Telegram сейчас недоступен' })
    }
  }

  // ─── Отзывы Google: есть ли Place ID и свежие снимки ───────────────────────
  const { data: branches } = await db.from('branches').select('id, google_place_id').eq('active', true)
  const total = branches?.length ?? 0
  const withPlace = branches?.filter(b => b.google_place_id).length ?? 0
  checks.push({
    id: 'place_ids', label: 'Place ID филиалов',
    level: total === 0 ? 'warn' : withPlace === total ? 'ok' : 'warn',
    detail: total === 0 ? 'Нет активных филиалов' : `${withPlace} из ${total} филиалов`,
    fix: withPlace < total ? 'У филиалов без Place ID отзывы Google не считаются — укажите ссылку на отзыв в карточке филиала' : undefined,
  })

  const { data: lastSnap } = await db
    .from('review_snapshots').select('captured_at').order('captured_at', { ascending: false }).limit(1).maybeSingle()
  const snapAt = lastSnap?.captured_at ?? null
  const snapFresh = snapAt ? Date.now() - new Date(snapAt).getTime() < 48 * 3600000 : false
  checks.push({
    id: 'snapshots', label: 'Снимки отзывов Google',
    level: snapAt ? (snapFresh ? 'ok' : 'warn') : 'warn',
    detail: `Последний: ${ago(snapAt)}`,
    fix: snapFresh ? undefined : 'Снимок снимается кроном раз в сутки. Можно обновить вручную кнопкой в разделе аналитики',
  })

  // ─── Ежедневные отчёты ─────────────────────────────────────────────────────
  if (!hourMissing) {
    const { data: rows } = await db
      .from('telegram_settings')
      .select('chat_id, notify_daily, active, report_hour, last_report_at')
    const live = (rows ?? []).filter(r => r.active && r.notify_daily && r.chat_id)
    const lastSent = live.map(r => r.last_report_at).filter(Boolean).sort().pop() ?? null
    checks.push({
      id: 'daily', label: 'Ежедневные отчёты',
      level: live.length === 0 ? 'warn' : lastSent ? 'ok' : 'warn',
      detail: live.length === 0
        ? 'Ни одна компания не подключена к отчётам'
        : `Подключено компаний: ${live.length} · последний отчёт: ${ago(lastSent)}`,
      fix: live.length === 0 ? 'Укажите Chat ID компании ниже и включите уведомления' : undefined,
    })
  }

  const worst: Level = checks.some(c => c.level === 'fail') ? 'fail'
    : checks.some(c => c.level === 'warn') ? 'warn' : 'ok'

  return NextResponse.json({ level: worst, checks })
}
