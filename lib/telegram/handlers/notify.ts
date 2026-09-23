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
      'Пока не настроен: не указан чат, куда его присылать.\n' +
      'Это делается один раз в кабинете — в разделе Telegram.',
      { reply_markup: keyboard([[{ text: '⚙️ Настроить в кабинете', url: 'https://birtapcard.vercel.app/telegram' }], navRow()]) }
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
