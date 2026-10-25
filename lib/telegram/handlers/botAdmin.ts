/**
 * lib/telegram/handlers/botAdmin.ts
 *
 * Пульт управления Telegram-ботом для super_admin.
 * Статус вебхука, количество активных рассылок/отчётов,
 * отправка тестового утреннего отчёта прямо сейчас.
 */

import { sendMessage, getWebhookInfo, getBotUsername, keyboard, escapeMd, type InlineButton } from '@/lib/telegram/bot'
import { db, findProfile } from '@/lib/telegram/db'
import { navRow } from '@/lib/telegram/keyboards/main'
import { fetchCompanyReport, formatReport, getReportRange, previousRange } from '@/lib/telegram/reports'

export async function handleAdminBotControl(chatId: number, telegramId: number) {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    await sendMessage(chatId, '⛔ Раздел доступен только администраторам.')
    return
  }

  const supabase = db()

  // 1. Статус вебхука из Telegram API
  const [webhookInfo, botUsername] = await Promise.all([
    getWebhookInfo(),
    getBotUsername(),
  ])

  // 2. Статистика настроек отчётов и клиентов
  const [reportsCountRes, clientsCountRes] = await Promise.all([
    supabase.from('telegram_settings').select('id', { count: 'exact', head: true }).eq('notify_daily', true),
    supabase.from('bot_clients').select('telegram_id', { count: 'exact', head: true }).eq('active', true),
  ])

  const reportsCount = reportsCountRes.count ?? 0
  const clientsCount = clientsCountRes.count ?? 0

  const webhookStatus = webhookInfo?.url ? '✅ Активен' : '⚠️ Не настроен'
  const pendingUpdates = webhookInfo?.pending_update_count ?? 0

  const text = `🤖 *Управление Telegram-ботом*\n\n` +
    `Бот: *@${escapeMd(botUsername || 'birtapcard_bot')}*\n` +
    `Вебхук: *${webhookStatus}*\n` +
    `Очередь сообщений (pending): *${pendingUpdates}*\n\n` +
    `📊 *Сводка использования:*\n` +
    `• Подключённых клиентов: *${clientsCount}*\n` +
    `• Активных утренних отчётов: *${reportsCount}* заведений\n` +
    `• Час отправки по умолчанию: *08:00* (Ташкент, UTC+5)\n\n` +
    `_Выберите действие:_`

  const actions: InlineButton[][] = [
    [
      { text: '⚡ Отправить тестовый утренний отчёт сюда', callback_data: 'tg_adm:test_report' },
    ],
    [
      { text: '📢 Новая рассылка клиентам', callback_data: 'platform:broadcast' },
      { text: '💌 Пригласить владельца', callback_data: 'platform:companies' },
    ],
    [
      { text: '🔄 Обновить статус вебхука', callback_data: 'tg_adm:refresh' },
    ],
    navRow(),
  ]

  await sendMessage(chatId, text, { reply_markup: keyboard(actions) })
}

/** Отправка тестового отчёта админу прямо в текущий чат */
export async function handleAdminSendTestReport(chatId: number, telegramId: number) {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') return

  const supabase = db()

  // Берём первое заведение для образца
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('active', true)
    .limit(1)

  if (!companies?.length) {
    await sendMessage(chatId, '❌ Нет активных заведений для генерации отчёта.')
    return
  }

  const sampleCompany = companies[0]
  const range = getReportRange('yesterday')
  const prev = previousRange(range)

  const reportData = await fetchCompanyReport(supabase, sampleCompany.id, range, prev)

  if (!reportData) {
    await sendMessage(chatId, `❌ Не удалось собрать отчёт для ${sampleCompany.name}.`)
    return
  }

  await sendMessage(chatId, `🔔 *Тестовый утренний отчёт (образец отправки):*`)
  await sendMessage(chatId, formatReport(reportData))
}
