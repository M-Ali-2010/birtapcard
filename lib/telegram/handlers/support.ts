/**
 * lib/telegram/handlers/support.ts
 *
 * Поддержка внутри бота, в обе стороны.
 *
 * Клиент пишет вопрос — он падает всем super_admin с кнопкой «Ответить».
 * Админ жмёт кнопку, пишет ответ в своём чате, и ответ приходит клиенту
 * от имени бота. Человеку не нужно никуда переходить и искать, кому писать,
 * а у нас остаётся история в support_messages.
 */

import { sendMessage, keyboard, escapeMd, type InlineButton } from '@/lib/telegram/bot'
import { db, findProfile, setState, getState, clearState } from '@/lib/telegram/db'
import { navRow } from '@/lib/telegram/keyboards/main'
import { salesMenu, superAdminChatIds } from '@/lib/telegram/handlers/sales'
import { menuForRole } from '@/lib/telegram/keyboards/menus'
import type { TgMessage } from '@/lib/telegram/types'

export const SUPPORT_STATE = 'support_message'
export const SUPPORT_REPLY_STATE = 'support_reply'

const CONTACTS =
  '✈️ Telegram: @birtapcard\n' +
  '📞 Телефон: +998 95 731 30 41\n' +
  '✉️ Почта: birtapcard@gmail.com'

/** Экран «Поддержка»: контакты + предложение написать прямо здесь */
export async function handleSupportMenu(chatId: number, telegramId: number) {
  const profile = await findProfile(telegramId)

  await sendMessage(chatId,
    '🆘 *Поддержка BirTapCard*\n\n' +
    'Напишите вопрос прямо здесь — ответим в этом же чате. ' +
    'Обычно отвечаем в течение часа в рабочее время.\n\n' +
    CONTACTS,
    {
      reply_markup: keyboard([
        [{ text: '✍️ Написать сообщение', callback_data: 'support:write' }],
        [{ text: '✈️ Написать в Telegram', url: 'https://t.me/birtapcard' }],
        ...(profile ? [navRow()] : []),
      ]),
    }
  )
}

export async function handleSupportWrite(chatId: number, telegramId: number) {
  await setState(telegramId, SUPPORT_STATE)
  await sendMessage(chatId,
    '✍️ Напишите ваш вопрос одним сообщением — я передам его команде.',
    { reply_markup: { keyboard: [[{ text: '❌ Отменить' }]], resize_keyboard: true, one_time_keyboard: true } }
  )
}

export async function isWritingSupport(telegramId: number): Promise<boolean> {
  const s = await getState(telegramId)
  return s?.state === SUPPORT_STATE || s?.state === SUPPORT_REPLY_STATE
}

/** Обрабатывает и вопрос клиента, и ответ админа — смотря какое состояние */
export async function handleSupportInput(chatId: number, telegramId: number, msg: TgMessage): Promise<boolean> {
  const state = await getState(telegramId)
  if (!state) return false

  const text = (msg.text ?? '').trim()
  const profile = await findProfile(telegramId)

  if (text === '❌ Отменить' || text === '/cancel') {
    await clearState(telegramId)
    await sendMessage(chatId, 'Отменено.', { reply_markup: profile ? menuForRole(profile.role) : salesMenu() })
    return true
  }

  // ─── Ответ администратора клиенту ────────────────────────────────────────
  if (state.state === SUPPORT_REPLY_STATE) {
    if (!text) return true
    await clearState(telegramId)

    const payload = (state.payload ?? {}) as { id?: string; to?: number }
    if (!payload.id || !payload.to) {
      await sendMessage(chatId, '⚠️ Не нашёл обращение, попробуйте ещё раз.')
      return true
    }

    const delivered = await sendMessage(payload.to,
      '🆘 *Ответ поддержки BirTapCard*\n\n' + escapeMd(text)
    )

    await db().from('support_messages').update({
      status: 'answered',
      answer: text,
      admin_telegram_id: telegramId,
      answered_at: new Date().toISOString(),
    }).eq('id', payload.id)

    await sendMessage(chatId,
      delivered.ok ? '✅ Ответ отправлен клиенту.' : `⚠️ Не удалось доставить: ${delivered.error ?? 'ошибка'}`,
      { reply_markup: profile ? menuForRole(profile.role) : undefined }
    )
    return true
  }

  // ─── Вопрос клиента ──────────────────────────────────────────────────────
  if (state.state === SUPPORT_STATE) {
    if (!text) return true
    await clearState(telegramId)

    const { data: row } = await db().from('support_messages').insert({
      telegram_id: telegramId,
      tg_username: msg.from?.username ?? null,
      user_id: profile?.user_id ?? null,
      company_id: profile?.company_id ?? null,
      text: text.slice(0, 4000),
    }).select('id').single()

    await sendMessage(chatId,
      '✅ Сообщение передано. Ответим здесь же, в этом чате.',
      { reply_markup: profile ? menuForRole(profile.role) : salesMenu() }
    )

    // ─── Дублируем всем админам ────────────────────────────────────────────
    const who = msg.from?.username ? `@${msg.from.username}` : (profile?.full_name ?? `id${telegramId}`)
    let companyName = ''
    if (profile?.company_id) {
      const { data: c } = await db().from('companies').select('name').eq('id', profile.company_id).single()
      companyName = c?.name ? ` · ${c.name}` : ''
    }

    const buttons: InlineButton[][] = row?.id
      ? [[{ text: '✍️ Ответить', callback_data: `support_reply:${row.id}` }]]
      : []

    for (const admin of await superAdminChatIds()) {
      if (admin === telegramId) continue
      await sendMessage(admin,
        `🆘 *Обращение в поддержку*\n\n` +
        `👤 ${escapeMd(who)}${escapeMd(companyName)}\n` +
        `${profile ? '🏪 клиент' : '👋 не клиент'}\n\n` +
        `_${escapeMd(text.slice(0, 900))}_`,
        buttons.length ? { reply_markup: keyboard(buttons) } : {}
      )
    }
    return true
  }

  return false
}

/** Админ нажал «Ответить» под обращением */
export async function handleSupportReplyStart(chatId: number, telegramId: number, messageId: string) {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    await sendMessage(chatId, '⛔ Нет доступа.')
    return
  }

  const { data: row } = await db()
    .from('support_messages')
    .select('id, telegram_id, text, status')
    .eq('id', messageId)
    .single()

  if (!row) {
    await sendMessage(chatId, '❌ Обращение не найдено.')
    return
  }

  await setState(telegramId, SUPPORT_REPLY_STATE, { id: row.id, to: Number(row.telegram_id) })
  await sendMessage(chatId,
    `✍️ Напишите ответ — он уйдёт клиенту от имени бота.\n\n_Вопрос: ${escapeMd(String(row.text).slice(0, 500))}_`,
    { reply_markup: { keyboard: [[{ text: '❌ Отменить' }]], resize_keyboard: true, one_time_keyboard: true } }
  )
}

/** Список необработанных обращений для админа */
export async function handleSupportInbox(chatId: number, telegramId: number) {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    await sendMessage(chatId, '⛔ Раздел доступен только администраторам.')
    return
  }

  const { data: rows } = await db()
    .from('support_messages')
    .select('id, tg_username, text, status, created_at')
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!rows?.length) {
    await sendMessage(chatId, '🆘 *Поддержка*\n\nНеотвеченных обращений нет.', { reply_markup: keyboard([navRow()]) })
    return
  }

  await sendMessage(chatId, `🆘 *Неотвеченных обращений: ${rows.length}*`)
  for (const r of rows) {
    const when = new Date(r.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    await sendMessage(chatId,
      `👤 ${escapeMd(r.tg_username ? '@' + r.tg_username : '—')} · _${when}_\n\n_${escapeMd(String(r.text).slice(0, 700))}_`,
      { reply_markup: keyboard([[{ text: '✍️ Ответить', callback_data: `support_reply:${r.id}` }]]) }
    )
  }
}
