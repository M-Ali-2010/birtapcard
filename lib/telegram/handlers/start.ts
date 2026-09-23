/**
 * lib/telegram/handlers/start.ts
 *
 * /start без токена — воронка для гостя или меню для клиента.
 * /start TOKEN — привязка Telegram-аккаунта к пользователю BirTap.
 * /start ЛЮБОЕ_СЛОВО — метка источника (карточка, презентация, /pdp):
 *   токен не найден, значит это не привязка, а переход по ссылке.
 */

import { sendMessage } from '@/lib/telegram/bot'
import { db, findProfile } from '@/lib/telegram/db'
import { menuForRole } from '@/lib/telegram/keyboards/menus'
import { handleSalesStart, handleLeadStart } from '@/lib/telegram/handlers/sales'
import type { TgUser } from '@/lib/telegram/types'

const ROLE_LABEL: Record<string, string> = {
  super_admin: '👑 Супер-администратор',
  owner: '🏪 Владелец',
  branch_manager: '📍 Управляющий филиалом',
}

export async function handleStart(chatId: number, telegramId: number, firstName?: string) {
  const profile = await findProfile(telegramId)

  // Не клиент — показываем витрину, а не тупик «привяжите аккаунт»
  if (!profile) {
    await handleSalesStart(chatId, firstName)
    return
  }

  await sendMessage(chatId,
    `✅ Привет, *${profile.full_name ?? 'друг'}*!\n\n` +
    `${ROLE_LABEL[profile.role] ?? ''}\n\n` +
    `Ваш аккаунт подключён. Используйте меню для управления.`,
    { reply_markup: menuForRole(profile.role) }
  )
}

export async function handleLinkToken(chatId: number, telegramId: number, tgUser: TgUser, token: string) {
  const supabase = db()

  const { data: acc } = await supabase
    .from('telegram_accounts')
    .select('id, user_id, expires_at')
    .eq('link_token', token)
    .is('confirmed_at', null)
    .single()

  // Токена нет в базе — это не привязка, а метка источника из ссылки
  // (t.me/birtapcard?start=card / pdp / info). Ведём человека в воронку.
  if (!acc) {
    const profile = await findProfile(telegramId)
    if (profile) {
      await sendMessage(chatId, '❌ Ссылка недействительна или уже использована. Запросите новую в личном кабинете.')
      return
    }
    if (/^(order|zayavka|lead)$/i.test(token)) {
      await handleLeadStart(chatId, telegramId, undefined, token.toLowerCase())
    } else {
      await handleSalesStart(chatId, tgUser.first_name)
    }
    return
  }

  if (acc.expires_at && new Date(acc.expires_at) < new Date()) {
    await sendMessage(chatId, '⏰ Ссылка истекла. Пожалуйста, запросите новую.')
    return
  }

  await supabase
    .from('telegram_accounts')
    .update({
      telegram_id: telegramId,
      username: tgUser.username ?? null,
      confirmed_at: new Date().toISOString(),
      link_token: null,
    })
    .eq('id', acc.id)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('user_id', acc.user_id)
    .single()

  await sendMessage(chatId,
    `✅ *Telegram успешно привязан!*\n\n` +
    `Добро пожаловать${profile?.full_name ? `, *${profile.full_name}*` : ''}!\n` +
    `${profile?.role ? ROLE_LABEL[profile.role] ?? '' : ''}\n\n` +
    `Теперь вы будете получать:\n` +
    `• Ежедневные отчёты по статистике\n` +
    `• Напоминания о подписке\n` +
    `• Уведомления об оплате\n\n` +
    `Используйте меню ниже для управления.`,
    { reply_markup: menuForRole(profile?.role as 'super_admin' | 'owner' | 'branch_manager' | undefined) }
  )
}
