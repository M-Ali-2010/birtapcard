/**
 * lib/telegram/handlers/usersAdmin.ts
 *
 * Управление пользователями и клиентами платформы для super_admin.
 * Показывает подключённых владельцев в Telegram (bot_clients),
 * администраторов и пользователей веб-кабинета (profiles).
 */

import { sendMessage, keyboard, escapeMd, type InlineButton } from '@/lib/telegram/bot'
import { db, findProfile } from '@/lib/telegram/db'
import { navRow } from '@/lib/telegram/keyboards/main'

export async function handleAdminUsers(chatId: number, telegramId: number) {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    await sendMessage(chatId, '⛔ Раздел доступен только администраторам.')
    return
  }

  const supabase = db()

  // 1. Клиенты, подключённые в боте
  const { data: botClients } = await supabase
    .from('bot_clients')
    .select('telegram_id, company_id, role, full_name, username, created_at, companies(name)')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(20)

  // 2. Пользователи из веб-кабинета
  const { count: webUsersCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  const clients = botClients || []

  let text = `👥 *Пользователи и клиенты BirTapCard*\n\n` +
    `📱 Подключено к боту: *${clients.length}* клиентов\n` +
    `💻 В веб-кабинете: *${webUsersCount ?? 0}* аккаунтов\n\n`

  if (!clients.length) {
    text += `_Клиенты в боте пока не зарегистрированы._\n\n` +
      `Чтобы подключить владельца, перейдите в «🏢 Заведения» → карточка заведения → «💌 Пригласить владельца».`
  } else {
    text += `*Клиенты в Telegram-боте:*\n`
    clients.forEach((c, idx) => {
      const compName = Array.isArray(c.companies)
        ? c.companies[0]?.name
        : (c.companies as { name?: string } | null)?.name || 'Заведение'

      const userTag = c.username ? `@${escapeMd(c.username)}` : `ID \`${c.telegram_id}\``
      const name = c.full_name ? escapeMd(c.full_name) : 'Клиент'
      const roleBadge = c.role === 'owner' ? '👑 Директор' : '👔 Менеджер'

      text += `${idx + 1}. *${name}* (${userTag})\n` +
        `   ${roleBadge} · 🏢 *${escapeMd(compName)}*\n`
    })
  }

  const actions: InlineButton[][] = [
    [{ text: '💌 Пригласить владельца (выбор заведения)', callback_data: 'platform:companies' }],
    navRow(),
  ]

  await sendMessage(chatId, text, { reply_markup: keyboard(actions) })
}
