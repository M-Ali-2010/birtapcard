/**
 * lib/telegram/handlers/notify.ts
 *
 * «🔔 Уведомления» — владелец сам решает, в каком часу приходит ежедневная
 * сводка и приходит ли вообще. Час хранится в telegram_settings.report_hour
 * по ташкентскому времени, крон разносит отчёты по этим часам.
 */

import { sendMessage, keyboard, answerCallback, type InlineButton } from '@/lib/telegram/bot'
import { db, findProfile } from '@/lib/telegram/db'
import { navRow } from '@/lib/telegram/keyboards/main'

/** Часы, которые показываем на выбор: утро смены, день, вечер после закрытия */
const HOURS = [7, 8, 9, 10, 12, 15, 18, 20, 22]

interface Row {
  id: string
  chat_id: string | null
  report_hour: number | null
  notify_daily: boolean
}

/**
 * Итог ensureDailyReport:
 *   created / attached / moved — отчёт теперь идёт в этот чат;
 *   kept  — уже шёл в этот самый чат;
 *   other — идёт в другой чат, и мы его не трогали (force не просили);
 *   error — не удалось сохранить.
 */
export type DailyReportSetup = 'created' | 'attached' | 'moved' | 'kept' | 'other' | 'error'

/**
 * Куда слать утренний отчёт компании. Строка telegram_settings создаётся здесь же,
 * в боте, — заходить для этого в кабинет не нужно.
 *   · строки нет        → создаём: в этот чат, 08:00, включён;
 *   · чат не был задан  → подставляем этот;
 *   · чат уже задан     → оставляем (force — переносим в этот).
 */
export async function ensureDailyReport(companyId: string, chatId: number, force = false): Promise<DailyReportSetup> {
  const supabase = db()
  const chat = String(chatId)

  const { data: row } = await supabase
    .from('telegram_settings').select('id, chat_id').eq('company_id', companyId).maybeSingle()

  if (!row) {
    const base = { company_id: companyId, chat_id: chat, notify_daily: true, active: true }
    let { error } = await supabase.from('telegram_settings').insert({ ...base, report_hour: 8 })
    // На старой базе колонки report_hour может не быть — тогда вставляем без неё (час по умолчанию 8)
    if (error) ({ error } = await supabase.from('telegram_settings').insert(base))
    if (error) console.error('telegram_settings insert error:', error)
    return error ? 'error' : 'created'
  }

  if (!row.chat_id) {
    const { error } = await supabase
      .from('telegram_settings').update({ chat_id: chat, notify_daily: true, active: true }).eq('id', row.id)
    return error ? 'error' : 'attached'
  }

  if (String(row.chat_id) === chat) return 'kept'

  if (force) {
    const { error } = await supabase
      .from('telegram_settings').update({ chat_id: chat, notify_daily: true, active: true }).eq('id', row.id)
    return error ? 'error' : 'moved'
  }

  return 'other'
}

/** В какой чат сейчас уходит утренний отчёт заведения (null — не задан) */
export async function getReportChat(companyId: string): Promise<string | null> {
  const { data } = await db()
    .from('telegram_settings').select('chat_id').eq('company_id', companyId).maybeSingle()
  return data?.chat_id ? String(data.chat_id) : null
}

/** Забрать отчёт заведения в свой чат могут владелец (директор) и администратор, управляющий филиалом — нет */
function canTakeOverReport(role: string): boolean {
  return role === 'owner' || role === 'super_admin'
}

/** Кнопка «Присылать отчёт сюда» у владельца — вместо отправки в кабинет */
export async function handleNotifySetup(chatId: number, telegramId: number, cbId: string) {
  const profile = await findProfile(telegramId)
  if (!profile?.company_id) {
    await answerCallback(cbId, '⛔ Нет доступа', true)
    return
  }
  const before = await getReportChat(profile.company_id)
  const res = await ensureDailyReport(profile.company_id, chatId, canTakeOverReport(profile.role))
  if (res === 'error') {
    await answerCallback(cbId, '❌ Не удалось включить', true)
    return
  }
  if (res === 'other') {
    await answerCallback(cbId, '⛔ Отчёт получает владелец заведения — перенести его может только он', true)
    return
  }
  // Прежнему получателю — весточка: молча забирать у человека отчёт нельзя
  if (res === 'moved' && before && Number(before) !== chatId) {
    await sendMessage(Number(before),
      '🔔 Утренний отчёт по заведению перенесён в другой чат. ' +
      'Вернуть его сюда можно в разделе «🔔 Отчёт» → «Присылать отчёт сюда».'
    )
  }
  await answerCallback(cbId, '🔔 Отчёт включён')
  await handleNotifyMenu(chatId, telegramId)
}

async function loadSettings(companyId: string): Promise<Row | null> {
  const { data } = await db()
    .from('telegram_settings')
    .select('id, chat_id, report_hour, notify_daily')
    .eq('company_id', companyId)
    .maybeSingle()
  return (data as Row) ?? null
}

function hourButtons(current: number): InlineButton[][] {
  const rows: InlineButton[][] = []
  for (let i = 0; i < HOURS.length; i += 3) {
    rows.push(
      HOURS.slice(i, i + 3).map(h => ({
        text: `${h === current ? '• ' : ''}${String(h).padStart(2, '0')}:00`,
        callback_data: `notify_hour:${h}`,
      }))
    )
  }
  return rows
}

export async function handleNotifyMenu(chatId: number, telegramId: number) {
  const profile = await findProfile(telegramId)
  if (!profile?.company_id) {
    await sendMessage(chatId, '⚠️ Ваш аккаунт не привязан к компании.')
    return
  }

  const row = await loadSettings(profile.company_id)

  if (!row || !row.chat_id) {
    await sendMessage(chatId,
      '🔔 *Ежедневный отчёт*\n\n' +
      'Пока не включён. Нажмите кнопку — и каждое утро в 08:00 сюда будет приходить ' +
      'сводка за вчера: касания, переходы по кнопкам, отзывы Google, лучшая точка.',
      { reply_markup: keyboard([[{ text: '✅ Присылать отчёт сюда', callback_data: 'notify_setup' }], navRow()]) }
    )
    return
  }

  // Отчёт идёт в другой чат: показывать «включён» и часы было бы враньём — сюда он не придёт
  if (String(row.chat_id) !== String(chatId)) {
    const canTake = canTakeOverReport(profile.role)
    await sendMessage(chatId,
      '🔔 *Ежедневный отчёт*\n\n' +
      'Сейчас отчёт по заведению приходит в *другой чат* — сюда он не приходит.\n\n' +
      (canTake
        ? 'Нажмите кнопку, и утренняя сводка будет приходить сюда.'
        : 'Получателя отчёта выбирает владелец заведения.'),
      {
        reply_markup: keyboard([
          ...(canTake ? [[{ text: '✅ Присылать отчёт сюда', callback_data: 'notify_setup' }]] : []),
          navRow(),
        ]),
      }
    )
    return
  }

  const hour = row.report_hour ?? 8
  const state = row.notify_daily ? `включён, в *${String(hour).padStart(2, '0')}:00*` : '*выключен*'

  await sendMessage(chatId,
    '🔔 *Ежедневный отчёт*\n\n' +
    `Статус: ${state}\n\n` +
    'В сводке за прошедшие сутки: касания, новые отзывы Google и рейтинг, ' +
    'переходы по каждой кнопке и лучшая точка.\n\n' +
    'Выберите час по ташкентскому времени:',
    {
      reply_markup: keyboard([
        ...hourButtons(hour),
        [{ text: row.notify_daily ? '🔕 Выключить отчёт' : '🔔 Включить отчёт', callback_data: 'notify_toggle' }],
        navRow(),
      ]),
    }
  )
}

export async function handleNotifyHour(chatId: number, telegramId: number, arg: string, cbId: string) {
  const profile = await findProfile(telegramId)
  if (!profile?.company_id) {
    await answerCallback(cbId, '⛔ Нет доступа', true)
    return
  }

  const hour = Number(arg)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    await answerCallback(cbId, '❌ Неверный час', true)
    return
  }

  const { error } = await db()
    .from('telegram_settings')
    .update({ report_hour: hour, notify_daily: true })
    .eq('company_id', profile.company_id)

  if (error) {
    await answerCallback(cbId, '❌ Не удалось сохранить', true)
    return
  }

  await answerCallback(cbId, `Отчёт в ${String(hour).padStart(2, '0')}:00`)
  await handleNotifyMenu(chatId, telegramId)
}

export async function handleNotifyToggle(chatId: number, telegramId: number, cbId: string) {
  const profile = await findProfile(telegramId)
  if (!profile?.company_id) {
    await answerCallback(cbId, '⛔ Нет доступа', true)
    return
  }

  const row = await loadSettings(profile.company_id)
  if (!row) {
    await answerCallback(cbId, '⚠️ Отчёт ещё не настроен', true)
    return
  }

  const next = !row.notify_daily
  await db().from('telegram_settings').update({ notify_daily: next }).eq('id', row.id)

  await answerCallback(cbId, next ? '🔔 Отчёт включён' : '🔕 Отчёт выключен')
  await handleNotifyMenu(chatId, telegramId)
}
