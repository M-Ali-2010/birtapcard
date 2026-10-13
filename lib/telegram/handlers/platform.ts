/**
 * lib/telegram/handlers/platform.ts
 *
 * Разделы супер-админа: пульс платформы, компании и рассылка.
 * До этого здесь были заглушки «появится в Фазе 4» — а смотреть, как идут
 * дела, хочется с телефона и без захода в кабинет.
 */

import { sendMessage, keyboard, escapeMd } from '@/lib/telegram/bot'
import { sendBranchLinks } from '@/lib/telegram/handlers/branches'
import { createOwnerInvite } from '@/lib/telegram/handlers/invite'
import { ensureDailyReport } from '@/lib/telegram/handlers/notify'
import { db, findProfile, setState, getState, clearState } from '@/lib/telegram/db'
import { navRow } from '@/lib/telegram/keyboards/main'
import { menuForRole } from '@/lib/telegram/keyboards/menus'
import {
  fetchCompanyReport, fetchOwnerReport, formatReport, getReportRange, previousRange, type ReportPeriod,
} from '@/lib/telegram/reports'

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
    `🏢 Заведений: *${n(companies)}* · 🏪 точек: *${n(branches)}*\n` +
    `💳 Активных подписок: *${n(subs)}*\n\n` +
    `👆 Касаний сегодня: *${n(tapsToday)}*\n` +
    `👆 За 7 дней: *${n(tapsWeek)}* · переходов: *${n(clicksWeek)}*\n` +
    `⭐ Новых отзывов Google за 7 дней: *${reviewsWeek}*\n\n` +
    `🔥 Новых заявок: *${n(newLeads)}*\n` +
    `🆘 Обращений без ответа: *${n(openSupport)}*`,
    {
      reply_markup: keyboard([
        [{ text: '🔥 Заявки', callback_data: 'leads:open' }, { text: '🆘 Поддержка', callback_data: 'support:inbox' }],
        [{ text: '🏢 Заведения', callback_data: 'platform:companies' }],
        navRow(),
      ]),
    }
  )
}

// ─── Заведения: список и отчёт по каждому ────────────────────────────────────

/** Периоды, которые есть на кнопках отчёта по заведению */
const COMPANY_PERIODS: Record<string, ReportPeriod> = {
  today: 'today',
  yesterday: 'yesterday',
  '7d': '7d',
  month: 'month',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ключ периода → тот, что есть на кнопках (week, 30d и т.п. сводим к 7 дням) */
function companyPeriodKey(period: string): string {
  if (period in COMPANY_PERIODS) return period
  if (period === 'week') return '7d'
  return '7d'
}

type CompanyRow = { id: string; name: string; active: boolean; points: number; taps: number }

/** Строки списка: сначала включённые по убыванию касаний, затем выключенные */
export function sortCompanyRows(rows: CompanyRow[]): CompanyRow[] {
  return [...rows].sort((a, b) =>
    Number(b.active) - Number(a.active) || b.taps - a.taps || a.name.localeCompare(b.name, 'ru')
  )
}

/** Кнопка заведения: «Название · 12», название обрезаем, чтобы влезло в ряд */
export function companyButtonLabel(row: CompanyRow): string {
  const name = row.name.length > 22 ? row.name.slice(0, 21) + '…' : row.name
  return `${row.active ? '' : '⏸ '}${name} · ${row.taps}`
}

/** Список заведений: касания за период и по кнопке на каждое — открывает отчёт */
async function sendCompanyList(chatId: number, periodKey: string, heading: string) {
  const supabase = db()
  const range = getReportRange(COMPANY_PERIODS[periodKey] ?? '7d')

  const { data: companies } = await supabase
    .from('companies').select('id, name, active').order('name')

  if (!companies?.length) {
    await sendMessage(chatId, '🏢 Заведений пока нет.', { reply_markup: keyboard([navRow()]) })
    return
  }

  const { data: branches } = await supabase
    .from('branches').select('id, company_id').eq('active', true)

  const { data: events } = await supabase
    .from('scan_events').select('branch_id')
    .gte('scanned_at', range.start.toISOString())
    .lte('scanned_at', range.end.toISOString())
    .limit(20000)

  const byBranch = new Map<string, number>()
  for (const e of events ?? []) byBranch.set(e.branch_id, (byBranch.get(e.branch_id) ?? 0) + 1)

  const rows = sortCompanyRows(companies.map(c => {
    const own = (branches ?? []).filter(b => b.company_id === c.id)
    const taps = own.reduce((sum, b) => sum + (byBranch.get(b.id) ?? 0), 0)
    return { id: c.id, name: c.name as string, active: c.active !== false, points: own.length, taps }
  }))

  const body = rows.map((r, i) =>
    `${i + 1}. ${r.active ? '' : '⏸ '}*${escapeMd(r.name)}* — ${r.taps} касаний _(точек: ${r.points})_`
  ).join('\n')

  // Inline-клавиатура: до 100 кнопок на сообщение — с запасом берём 90
  const shown = rows.slice(0, 90)
  const buttons = shown.map(r => ({
    text: companyButtonLabel(r),
    callback_data: `co:${r.id}:${periodKey}`,
  }))
  const grid: { text: string; callback_data: string }[][] = []
  for (let i = 0; i < buttons.length; i += 2) grid.push(buttons.slice(i, i + 2))

  const more = rows.length > shown.length ? `\n\n_Показаны первые ${shown.length} из ${rows.length}._` : ''

  await sendMessage(chatId,
    `${heading} — ${range.label}\n\n${body}${more}\n\n_Нажмите на заведение — откроется его отчёт._`,
    { reply_markup: keyboard([...grid, navRow()]) }
  )
}

/** «🏢 Заведения» — все заведения, кто сколько принёс за неделю */
export async function handleCompanies(chatId: number, telegramId: number) {
  if (!(await requireAdmin(chatId, telegramId))) return
  await sendCompanyList(chatId, '7d', '🏢 *Заведения*')
}

/** Администратор попросил отчёт без компании (/today, «Аналитика») — сначала выбираем заведение */
export async function handleCompanyPicker(chatId: number, period: string) {
  await sendCompanyList(chatId, companyPeriodKey(period), '🏢 *Выберите заведение*')
}

/** Кнопки отчёта по заведению: периоды, переключатель «общий / по точкам», назад к списку */
export function companyReportKeyboard(companyId: string, periodKey: string, mode: 'summary' | 'points') {
  const period = (key: string, label: string) => ({
    text: (key === periodKey ? '● ' : '') + label,
    callback_data: mode === 'points' ? `co:${companyId}:pts:${key}` : `co:${companyId}:${key}`,
  })
  const toggle = mode === 'points'
    ? { text: '📊 Общий отчёт', callback_data: `co:${companyId}:${periodKey}` }
    : { text: '🏪 По точкам', callback_data: `co:${companyId}:pts:${periodKey}` }
  return keyboard([
    [period('today', 'Сегодня'), period('yesterday', 'Вчера')],
    [period('7d', '7 дней'), period('month', 'Месяц')],
    [toggle],
    [
      { text: '🔗 Ссылки точек', callback_data: `co:${companyId}:links` },
      { text: '👤 Пригласить владельца', callback_data: `co:${companyId}:inv` },
    ],
    [{ text: '🔔 Отчёт в 08:00 — сюда', callback_data: `co:${companyId}:rep` }],
    navRow('platform:companies'),
  ])
}

/** Кнопка возврата к отчёту заведения */
function backToCompany(companyId: string) {
  return keyboard([[{ text: '🔙 К заведению', callback_data: `co:${companyId}:7d` }], navRow()])
}

async function companyName(companyId: string): Promise<string | null> {
  const { data } = await db().from('companies').select('name').eq('id', companyId).maybeSingle()
  return (data?.name as string | undefined) ?? null
}

/** «👤 Пригласить владельца»: одноразовая ссылка, по которой человек сразу попадает в бота */
async function sendOwnerInvite(chatId: number, telegramId: number, companyId: string) {
  const res = await createOwnerInvite(telegramId, companyId)
  if (!res.ok) {
    const why =
      res.reason === 'no-company' ? 'Заведение не найдено.' :
      res.reason === 'no-bot-name' ? 'Не удалось определить имя бота. Задайте переменную TELEGRAM_BOT_USERNAME в Vercel.' :
      'Не удалось создать приглашение. Если ещё не выполнена миграция 0008_bot_clients.sql — запустите её в Supabase.'
    await sendMessage(chatId, `❌ ${why}`, { reply_markup: backToCompany(companyId) })
    return
  }
  await sendMessage(chatId,
    `👤 *Приглашение владельца*\n🏢 ${escapeMd(res.companyName)}\n\n` +
    `Перешлите эту ссылку человеку. Он откроет бота и сразу увидит свои отчёты — ` +
    `сайт и приложение не нужны:\n\n${res.link}\n\n` +
    `_Ссылка одноразовая, действует 14 дней. Утренний отчёт в 08:00 включится у него сам._`,
    { reply_markup: backToCompany(companyId), disable_web_page_preview: true }
  )
}

/**
 * «🔔 Отчёт в 08:00 — сюда»: утренняя сводка заведения уходит в этот чат.
 * Если отчёт уже идёт в другой чат (например, владельцу), сначала спрашиваем:
 * молча забирать у человека его отчёт нельзя.
 */
async function setReportHere(chatId: number, companyId: string, confirmed = false) {
  const name = await companyName(companyId)
  if (!name) {
    await sendMessage(chatId, '⚠️ Заведение не найдено.', { reply_markup: keyboard([navRow('platform:companies')]) })
    return
  }

  if (!confirmed) {
    const { data: row } = await db()
      .from('telegram_settings').select('chat_id').eq('company_id', companyId).maybeSingle()
    if (row?.chat_id && String(row.chat_id) !== String(chatId)) {
      await sendMessage(chatId,
        `🔔 *Отчёт уже идёт в другой чат*\n🏢 ${escapeMd(name)}\n\n` +
        `Если перенести его сюда, прежний получатель утром ничего не получит. Перенести?`,
        {
          reply_markup: keyboard([
            [{ text: '✅ Да, перенести сюда', callback_data: `co:${companyId}:repok` }],
            [{ text: '🔙 К заведению', callback_data: `co:${companyId}:7d` }],
          ]),
        }
      )
      return
    }
  }

  const res = await ensureDailyReport(companyId, chatId, true)
  if (res === 'error') {
    await sendMessage(chatId, '❌ Не удалось сохранить. Проверьте, что в базе есть таблица telegram_settings.', {
      reply_markup: backToCompany(companyId),
    })
    return
  }
  await sendMessage(chatId,
    `🔔 *Отчёт включён*\n🏢 ${escapeMd(name)}\n\n` +
    `Каждое утро в *08:00* (Ташкент) сюда будет приходить сводка за вчера: касания, ` +
    `переходы по кнопкам, отзывы Google и лучшая точка.`,
    {
      reply_markup: keyboard([
        [{ text: '📨 Прислать пример сейчас', callback_data: `co:${companyId}:now` }],
        [{ text: '🔙 К заведению', callback_data: `co:${companyId}:7d` }],
        navRow(),
      ]),
    }
  )
}

/** «📨 Прислать пример»: то же сообщение, что уходит утром (отчёт за вчера) */
async function sendMorningSample(chatId: number, companyId: string) {
  const supabase = db()
  const range = getReportRange('yesterday')
  const data = await fetchCompanyReport(supabase, companyId, range, previousRange(range))
  if (!data) {
    await sendMessage(chatId, '😕 У заведения нет активных точек — отчёт строить не из чего.', {
      reply_markup: backToCompany(companyId),
    })
    return
  }
  await sendMessage(chatId, formatReport(data), { reply_markup: backToCompany(companyId) })
}

/**
 * Отчёт по одному заведению для супер-админа.
 * arg: «<id>[:период]» — общий отчёт, «<id>:pts:<период>» — разбивка по точкам.
 */
export async function handleCompanyReport(chatId: number, telegramId: number, arg: string) {
  if (!(await requireAdmin(chatId, telegramId))) return

  const parts = arg.split(':')
  const companyId = parts[0]
  if (!UUID.test(companyId ?? '')) {
    await sendMessage(chatId, '⚠️ Не понял, какое заведение.', { reply_markup: keyboard([navRow('platform:companies')]) })
    return
  }

  // Действия над заведением: приглашение, ссылки, утренний отчёт
  if (parts[1] === 'inv') { await sendOwnerInvite(chatId, telegramId, companyId); return }
  if (parts[1] === 'links') { await sendBranchLinks(chatId, companyId, { back: `co:${companyId}:7d` }); return }
  if (parts[1] === 'rep') { await setReportHere(chatId, companyId); return }
  if (parts[1] === 'repok') { await setReportHere(chatId, companyId, true); return }
  if (parts[1] === 'now') { await sendMorningSample(chatId, companyId); return }

  const mode: 'summary' | 'points' = parts[1] === 'pts' ? 'points' : 'summary'
  const periodKey = companyPeriodKey((mode === 'points' ? parts[2] : parts[1]) ?? '7d')
  const range = getReportRange(COMPANY_PERIODS[periodKey] ?? '7d')
  const supabase = db()
  const kb = companyReportKeyboard(companyId, periodKey, mode)

  if (mode === 'points') {
    const data = await fetchCompanyReport(supabase, companyId, range)
    if (!data) {
      await sendMessage(chatId, '😕 У заведения нет активных точек.', { reply_markup: kb })
      return
    }
    const sorted = [...data.branches].sort((a, b) => b.total - a.total)
    const medals = ['🥇', '🥈', '🥉']
    const lines = sorted.map((b, i) =>
      `${medals[i] && b.total > 0 ? medals[i] : `${i + 1}.`} *${escapeMd(b.branchName)}* — ${b.total}` +
      `  _(NFC ${b.nfc} · QR ${b.qr} · уникальных ${b.unique})_`
    )
    await sendMessage(chatId,
      `🏪 *Точки · ${range.label}*\n🏢 ${escapeMd(data.companyName)}\n\n${lines.join('\n')}` +
      (sorted.every(b => b.total === 0) ? '\n\n_Касаний не было._' : ''),
      { reply_markup: kb }
    )
    return
  }

  const report = await fetchOwnerReport(supabase, companyId, range)
  if (!report) {
    await sendMessage(chatId, '😕 У заведения нет активных точек — отчёт строить не из чего.', { reply_markup: kb })
    return
  }
  await sendMessage(chatId, report, { reply_markup: kb })
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

  const ids = new Set<number>()

  if (accounts?.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, role')
      .in('user_id', accounts.map(a => a.user_id))

    const allowed = new Set((profiles ?? []).filter(p => p.role !== 'super_admin').map(p => p.user_id))
    for (const a of accounts) if (allowed.has(a.user_id)) ids.add(Number(a.telegram_id))
  }

  // Клиенты, подключённые приглашением из бота (миграция 0008), — тоже получают рассылку
  const { data: botClients } = await supabase
    .from('bot_clients').select('telegram_id').eq('active', true)
  for (const c of botClients ?? []) ids.add(Number(c.telegram_id))

  return [...ids]
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
