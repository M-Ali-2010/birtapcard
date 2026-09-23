/**
 * lib/telegram/handlers/platform.ts
 *
 * Разделы супер-админа: пульс платформы, компании и рассылка.
 * До этого здесь были заглушки «появится в Фазе 4» — а смотреть, как идут
 * дела, хочется с телефона и без захода в кабинет.
 */

import { sendMessage, keyboard, escapeMd } from '@/lib/telegram/bot'
import { db, findProfile, setState, getState, clearState } from '@/lib/telegram/db'
import { navRow } from '@/lib/telegram/keyboards/main'
import { menuForRole } from '@/lib/telegram/keyboards/menus'
import { getReportRange } from '@/lib/telegram/reports'

export const BROADCAST_STATE = 'broadcast_text'

async function requireAdmin(chatId: number, telegramId: number) {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    await sendMessage(chatId, '⛔ Раздел доступен только администраторам.')
    return null
  }
  return profile
}

/** «📊 Статистика платформы» — всё главное одним экраном */
export async function handlePlatformStats(chatId: number, telegramId: number) {
  if (!(await requireAdmin(chatId, telegramId))) return

  const supabase = db()
  const today = getReportRange('today')
  const week = getReportRange('7d')

  const [companies, branches, tapsToday, tapsWeek, clicksWeek, newLeads, openSupport, subs] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('branches').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('scan_events').select('id', { count: 'exact', head: true }).gte('scanned_at', today.start.toISOString()),
    supabase.from('scan_events').select('id', { count: 'exact', head: true }).gte('scanned_at', week.start.toISOString()),
    supabase.from('link_clicks').select('id', { count: 'exact', head: true }).gte('clicked_at', week.start.toISOString()),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('support_messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  // Новые отзывы Google за неделю — по разнице снимков
  const { data: snaps } = await supabase
    .from('review_snapshots')
    .select('branch_id, review_count, captured_at')
    .gte('captured_at', new Date(week.start.getTime() - 3 * 86400000).toISOString())
    .order('captured_at', { ascending: true })
    .limit(5000)

  const first = new Map<string, number>()
  const last = new Map<string, number>()
  for (const s of snaps ?? []) {
    const at = new Date(s.captured_at).getTime()
    if (at < week.start.getTime()) first.set(s.branch_id, s.review_count ?? 0)
    else last.set(s.branch_id, s.review_count ?? 0)
  }
  let reviewsWeek = 0
  for (const [id, end] of last) {
    const start = first.get(id)
    if (start !== undefined) reviewsWeek += Math.max(0, end - start)
  }

  const n = (r: { count: number | null }) => r.count ?? 0

  await sendMessage(chatId,
    '📊 *Платформа BirTapCard*\n\n' +
    `🏢 Компаний: *${n(companies)}* · 🏪 точек: *${n(branches)}*\n` +
    `💳 Активных подписок: *${n(subs)}*\n\n` +
    `👆 Касаний сегодня: *${n(tapsToday)}*\n` +
    `👆 За 7 дней: *${n(tapsWeek)}* · переходов: *${n(clicksWeek)}*\n` +
    `⭐ Новых отзывов Google за 7 дней: *${reviewsWeek}*\n\n` +
    `🔥 Новых заявок: *${n(newLeads)}*\n` +
    `🆘 Обращений без ответа: *${n(openSupport)}*`,
    {
      reply_markup: keyboard([
        [{ text: '🔥 Заявки', callback_data: 'leads:open' }, { text: '🆘 Поддержка', callback_data: 'support:inbox' }],
        [{ text: '🏢 Компании', callback_data: 'platform:companies' }],
        navRow(),
      ]),
    }
  )
}

/** «🏢 Компании» — кто сколько принёс за неделю */
export async function handleCompanies(chatId: number, telegramId: number) {
  if (!(await requireAdmin(chatId, telegramId))) return

  const supabase = db()
  const week = getReportRange('7d')

  const { data: companies } = await supabase
    .from('companies').select('id, name').eq('active', true).order('name')

  if (!companies?.length) {
    await sendMessage(chatId, '🏢 Активных компаний нет.', { reply_markup: keyboard([navRow()]) })
    return
  }

  const { data: branches } = await supabase
    .from('branches').select('id, company_id, name').eq('active', true)

  const { data: events } = await supabase
    .from('scan_events').select('branch_id')
    .gte('scanned_at', week.start.toISOString()).limit(20000)

  const byBranch = new Map<string, number>()
  for (const e of events ?? []) byBranch.set(e.branch_id, (byBranch.get(e.branch_id) ?? 0) + 1)

  const rows = companies.map(c => {
    const own = (branches ?? []).filter(b => b.company_id === c.id)
    const taps = own.reduce((sum, b) => sum + (byBranch.get(b.id) ?? 0), 0)
    return { name: c.name, points: own.length, taps }
  }).sort((a, b) => b.taps - a.taps)

  const body = rows.map((r, i) =>
    `${i + 1}. *${escapeMd(r.name)}* — ${r.taps} касаний _(точек: ${r.points})_`
  ).join('\n')

  await sendMessage(chatId,
    `🏢 *Компании* — касания за 7 дней\n\n${body}`,
    { reply_markup: keyboard([navRow()]) }
  )
}

// ─── Рассылка ────────────────────────────────────────────────────────────────

/** Кому уйдёт рассылка: все подтверждённые аккаунты клиентов */
async function broadcastAudience(): Promise<number[]> {
  const supabase = db()
  const { data: accounts } = await supabase
    .from('telegram_accounts')
    .select('telegram_id, user_id')
    .eq('active', true)
    .not('confirmed_at', 'is', null)

  if (!accounts?.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, role')
    .in('user_id', accounts.map(a => a.user_id))

  const allowed = new Set((profiles ?? []).filter(p => p.role !== 'super_admin').map(p => p.user_id))
  return accounts.filter(a => allowed.has(a.user_id)).map(a => Number(a.telegram_id))
}

export async function handleBroadcastStart(chatId: number, telegramId: number) {
  if (!(await requireAdmin(chatId, telegramId))) return

  const audience = await broadcastAudience()
  if (!audience.length) {
    await sendMessage(chatId, '📢 Некому отправлять: нет привязанных клиентов.', { reply_markup: keyboard([navRow()]) })
    return
  }

  await setState(telegramId, BROADCAST_STATE)
  await sendMessage(chatId,
    `📢 *Рассылка*\n\nПолучателей: *${audience.length}*.\n\n` +
    'Напишите текст сообщения — перед отправкой покажу, как он будет выглядеть.',
    { reply_markup: { keyboard: [[{ text: '❌ Отменить' }]], resize_keyboard: true, one_time_keyboard: true } }
  )
}

export async function isComposingBroadcast(telegramId: number): Promise<boolean> {
  const s = await getState(telegramId)
  return s?.state === BROADCAST_STATE
}

/** Показ черновика с подтверждением — рассылку нельзя отправить одним касанием */
export async function handleBroadcastText(chatId: number, telegramId: number, text: string): Promise<boolean> {
  const state = await getState(telegramId)
  if (state?.state !== BROADCAST_STATE) return false

  const profile = await findProfile(telegramId)

  if (text === '❌ Отменить' || text === '/cancel') {
    await clearState(telegramId)
    await sendMessage(chatId, 'Рассылка отменена.', { reply_markup: menuForRole(profile?.role) })
    return true
  }
  if (!text) return true

  const audience = await broadcastAudience()
  await setState(telegramId, BROADCAST_STATE, { text })

  await sendMessage(chatId,
    `📢 *Так увидят клиенты:*\n\n${escapeMd(text)}\n\n` +
    `Получателей: *${audience.length}*. Отправляем?`,
    {
      reply_markup: keyboard([
        [{ text: `✅ Отправить (${audience.length})`, callback_data: 'broadcast:send' }],
        [{ text: '❌ Отменить', callback_data: 'broadcast:cancel' }],
      ]),
    }
  )
  return true
}

export async function handleBroadcastSend(chatId: number, telegramId: number) {
  const profile = await requireAdmin(chatId, telegramId)
  if (!profile) return

  const state = await getState(telegramId)
  const text = (state?.payload as { text?: string } | null)?.text
  if (state?.state !== BROADCAST_STATE || !text) {
    await sendMessage(chatId, '⚠️ Текст рассылки потерялся. Начните заново.')
    return
  }

  await clearState(telegramId)
  const audience = await broadcastAudience()
  await sendMessage(chatId, `📤 Отправляю ${audience.length}…`)

  let sent = 0
  let failed = 0
  for (const to of audience) {
    const res = await sendMessage(to, escapeMd(text))
    if (res.ok) sent++
    else failed++
    // Telegram ограничивает ~30 сообщений в секунду — держимся заметно ниже
    await new Promise(r => setTimeout(r, 60))
  }

  await sendMessage(chatId,
    `📢 *Рассылка завершена*\n\n✅ Доставлено: *${sent}*` + (failed ? `\n⚠️ Не доставлено: *${failed}*` : ''),
    { reply_markup: menuForRole(profile.role) }
  )
}

export async function handleBroadcastCancel(chatId: number, telegramId: number) {
  await clearState(telegramId)
  const profile = await findProfile(telegramId)
  await sendMessage(chatId, 'Рассылка отменена.', { reply_markup: menuForRole(profile?.role) })
}
