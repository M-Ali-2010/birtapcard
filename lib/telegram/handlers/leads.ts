/**
 * lib/telegram/handlers/leads.ts
 *
 * Обратная сторона воронки: раздел «🔥 Заявки» у super_admin.
 * Список свежих заявок из бота и смена статуса в один тап прямо из чата —
 * чтобы не заходить в кабинет ради «беру в работу».
 */

import { sendMessage, answerCallback, keyboard, escapeMd, type InlineButton } from '@/lib/telegram/bot'
import { db, findProfile } from '@/lib/telegram/db'

const STATUS_LABEL: Record<string, string> = {
  new: '🆕 Новая',
  in_progress: '🤝 В работе',
  won: '✅ Подключили',
  lost: '❌ Отказ',
}

const PLAN_LABEL: Record<string, string> = {
  start: '🟢 Старт',
  business: '🔵 Бизнес',
  pro: '🟡 Pro',
}

interface LeadRow {
  id: string
  venue: string | null
  city: string | null
  phone: string | null
  plan: string | null
  status: string
  tg_username: string | null
  contact_name: string | null
  created_at: string
}

function formatLead(lead: LeadRow): string {
  const when = new Date(lead.created_at).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  const who = lead.tg_username ? `@${lead.tg_username}` : lead.contact_name ?? '—'
  return (
    `${STATUS_LABEL[lead.status] ?? lead.status} · _${when}_\n` +
    `🏪 *${escapeMd(lead.venue ?? '—')}* · 📍 ${escapeMd(lead.city ?? '—')}\n` +
    `📞 \`${(lead.phone ?? '—').replace(/`/g, '')}\` · 👤 ${escapeMd(who)}\n` +
    `💳 ${lead.plan ? PLAN_LABEL[lead.plan] ?? lead.plan : '—'}`
  )
}

function leadButtons(lead: LeadRow): InlineButton[][] {
  const rows: InlineButton[][] = []
  if (lead.tg_username) rows.push([{ text: '✈️ Написать', url: `https://t.me/${lead.tg_username}` }])

  const actions: InlineButton[] = []
  if (lead.status !== 'in_progress') actions.push({ text: '🤝 В работу', callback_data: `lead_set:in_progress:${lead.id}` })
  if (lead.status !== 'won') actions.push({ text: '✅ Подключили', callback_data: `lead_set:won:${lead.id}` })
  if (lead.status !== 'lost') actions.push({ text: '❌ Отказ', callback_data: `lead_set:lost:${lead.id}` })
  if (actions.length) rows.push(actions)

  return rows
}

/** «🔥 Заявки» — свежие заявки, по умолчанию новые и в работе */
export async function handleLeadsList(chatId: number, telegramId: number, filter = 'open') {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    await sendMessage(chatId, '⛔ Раздел доступен только администраторам.')
    return
  }

  const supabase = db()
  let query = supabase
    .from('leads')
    .select('id, venue, city, phone, plan, status, tg_username, contact_name, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (filter === 'open') query = query.in('status', ['new', 'in_progress'])
  else if (filter !== 'all') query = query.eq('status', filter)

  const { data: leads, error } = await query

  if (error) {
    await sendMessage(chatId, '❌ Не удалось загрузить заявки. Попробуйте ещё раз.')
    return
  }

  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new')

  const filterRow: InlineButton[] = [
    { text: filter === 'open' ? '• Открытые' : 'Открытые', callback_data: 'leads:open' },
    { text: filter === 'won' ? '• Клиенты' : 'Клиенты', callback_data: 'leads:won' },
    { text: filter === 'all' ? '• Все' : 'Все', callback_data: 'leads:all' },
  ]

  if (!leads?.length) {
    await sendMessage(chatId, '🔥 *Заявки*\n\nПусто — в этом фильтре заявок нет.', {
      reply_markup: keyboard([filterRow]),
    })
    return
  }

  await sendMessage(chatId, `🔥 *Заявки* — новых: ${count ?? 0}`, { reply_markup: keyboard([filterRow]) })

  for (const lead of leads as LeadRow[]) {
    const rows = leadButtons(lead)
    await sendMessage(chatId, formatLead(lead), rows.length ? { reply_markup: keyboard(rows) } : {})
  }
}

/** Смена статуса заявки из inline-кнопки */
export async function handleLeadStatus(callbackId: string, chatId: number, telegramId: number, arg: string) {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    await answerCallback(callbackId, '⛔ Нет доступа', true)
    return
  }

  const [status, leadId] = arg.split(':')
  if (!status || !leadId || !STATUS_LABEL[status]) {
    await answerCallback(callbackId, '❌ Неизвестный статус', true)
    return
  }

  const supabase = db()
  const { error } = await supabase
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) {
    await answerCallback(callbackId, '❌ Не удалось обновить', true)
    return
  }

  await answerCallback(callbackId, `${STATUS_LABEL[status]}`)
  await sendMessage(chatId, `Статус заявки обновлён: ${STATUS_LABEL[status]}`)
}
