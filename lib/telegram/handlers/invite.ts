/**
 * lib/telegram/handlers/invite.ts
 *
 * Подключение клиента без сайта и приложения.
 *
 * Администратор в боте нажимает «Пригласить владельца» на карточке заведения и
 * получает ссылку t.me/<бот>?start=inv_<код>. Человек открывает её — и сразу
 * попадает в меню владельца со своими цифрами. Учётная запись в кабинете не
 * нужна: связь «Telegram → заведение» хранится в bot_clients (миграция 0008).
 *
 * При подключении сам собой включается утренний отчёт в 08:00 (по Ташкенту)
 * в чат этого человека — отдельно настраивать ничего не надо.
 */

import { randomBytes } from 'crypto'
import { sendMessage, escapeMd, getBotUsername } from '@/lib/telegram/bot'
import { db, findProfile } from '@/lib/telegram/db'
import { menuForRole } from '@/lib/telegram/keyboards/menus'
import { applyCommandsForChat } from '@/lib/telegram/profile'
import { ensureDailyReport, getReportChat } from '@/lib/telegram/handlers/notify'
import type { TgUser } from '@/lib/telegram/types'

/** Префикс кода в ссылке: /start inv_<код> */
export const INVITE_PREFIX = 'inv_'

/** Без похожих символов (0/o, 1/l/i): код иногда диктуют голосом */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function newInviteCode(length = 10): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

export type CreateInviteResult =
  | { ok: true; link: string; companyName: string }
  | { ok: false; reason: 'no-company' | 'no-bot-name' | 'db'; detail?: string }

/**
 * Сообщение, которое администратор пересылает человеку.
 *
 * Ссылка содержит «_» (birtapcard_bot, inv_<код>), а сообщение уходит в Markdown:
 * Telegram принимает пару подчёркиваний за курсив и «съедает» их — получалось
 * t.me/birtapcardbot?start=inv… и ссылка вела не туда. Поэтому подчёркивания экранируем.
 */
export function inviteForwardText(companyName: string, link: string): string {
  return (
    `📊 *${escapeMd(companyName)}* — отчёты BirTapCard в Telegram\n\n` +
    `Откройте ссылку и нажмите *Start* («Запустить»):\n${escapeMd(link)}`
  )
}

/** Создаёт одноразовое приглашение владельца и собирает из него ссылку */
export async function createOwnerInvite(adminTelegramId: number, companyId: string): Promise<CreateInviteResult> {
  const supabase = db()

  const { data: company } = await supabase
    .from('companies').select('name').eq('id', companyId).maybeSingle()
  if (!company) return { ok: false, reason: 'no-company' }

  const username = await getBotUsername()
  if (!username) return { ok: false, reason: 'no-bot-name' }

  const code = newInviteCode()
  const { error } = await supabase.from('bot_invites').insert({
    code,
    company_id: companyId,
    role: 'owner',
    created_by: adminTelegramId,
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  })
  if (error) {
    console.error('bot_invites insert error:', error)
    return { ok: false, reason: 'db', detail: error.message }
  }

  return { ok: true, link: `https://t.me/${username}?start=${INVITE_PREFIX}${code}`, companyName: company.name as string }
}

/** Гость открыл ссылку-приглашение */
export async function handleInviteAccept(chatId: number, telegramId: number, tgUser: TgUser, code: string) {
  const supabase = db()

  const { data: inv } = await supabase
    .from('bot_invites')
    .select('code, company_id, branch_id, role, created_by, expires_at, used_by, used_at')
    .eq('code', code)
    .maybeSingle()

  if (!inv) {
    await sendMessage(chatId, '❌ Ссылка недействительна. Попросите новую у того, кто вас приглашал.')
    return
  }

  const mine = inv.used_at && Number(inv.used_by) === telegramId
  if (inv.used_at && !mine) {
    await sendMessage(chatId, '❌ Эта ссылка уже использована. Попросите новую у того, кто вас приглашал.')
    return
  }
  if (!inv.used_at && new Date(inv.expires_at) < new Date()) {
    await sendMessage(chatId, '⏰ Срок ссылки истёк. Попросите новую.')
    return
  }

  const { data: company } = await supabase
    .from('companies').select('name').eq('id', inv.company_id).maybeSingle()
  if (!company) {
    await sendMessage(chatId, '❌ Заведение не найдено. Попросите новую ссылку.')
    return
  }

  const role = inv.role === 'branch_manager' ? 'branch_manager' : 'owner'
  const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || null

  if (!mine) {
    // Одноразовость: забираем приглашение условным обновлением, второй раз оно уже не сработает
    const { data: claimed } = await supabase
      .from('bot_invites')
      .update({ used_by: telegramId, used_at: new Date().toISOString() })
      .eq('code', code)
      .is('used_at', null)
      .select('code')
    if (!claimed?.length) {
      await sendMessage(chatId, '❌ Эта ссылка уже использована. Попросите новую.')
      return
    }

    const { error } = await supabase.from('bot_clients').upsert({
      telegram_id: telegramId,
      company_id: inv.company_id,
      branch_id: inv.branch_id ?? null,
      role,
      full_name: fullName,
      username: tgUser.username ?? null,
      active: true,
    }, { onConflict: 'telegram_id' })
    if (error) {
      console.error('bot_clients upsert error:', error)
      await sendMessage(chatId, '❌ Не удалось подключить. Напишите в поддержку — разберёмся.')
      return
    }

    // Утренний отчёт — в чат этого человека. Если он уже идёт в чат администратора платформы
    // (тот пробовал «Отчёт в 08:00 — сюда»), директору он нужнее — переносим. Чат другого
    // клиента не трогаем.
    const companyId = inv.company_id as string
    let report = await ensureDailyReport(companyId, chatId)
    let movedFrom: string | null = null
    if (report === 'other') {
      const holder = await getReportChat(companyId)
      const holderProfile = holder ? await findProfile(Number(holder)) : null
      if (holder && holderProfile?.role === 'super_admin') {
        report = await ensureDailyReport(companyId, chatId, true)
        if (report === 'moved') movedFrom = holder
      }
    }
    const reportHere = report === 'created' || report === 'attached' || report === 'moved' || report === 'kept'

    // Тому, кто приглашал, — весточка, с честным статусом отчёта
    if (inv.created_by) {
      const status = reportHere
        ? (movedFrom
            ? '🔔 Утренний отчёт теперь приходит ему — раньше он шёл в чат администратора. ' +
              'Вернуть себе: заведение → «🔔 Отчёт в 08:00 — сюда».'
            : '🔔 Утренний отчёт приходит ему.')
        : '⚠️ Утренний отчёт по заведению идёт в другой чат — ему он пока не приходит.'
      await sendMessage(Number(inv.created_by),
        `✅ *${escapeMd(fullName ?? 'Клиент')}*${tgUser.username ? ` (@${escapeMd(tgUser.username)})` : ''} ` +
        `подключился к *${escapeMd(company.name as string)}*.\n${status}`
      )
      // Прежний получатель — другой администратор: он тоже должен знать, куда делся отчёт
      if (movedFrom && Number(movedFrom) !== Number(inv.created_by)) {
        await sendMessage(Number(movedFrom),
          `🔔 Утренний отчёт по *${escapeMd(company.name as string)}* теперь приходит директору. ` +
          'Вернуть себе: заведение → «🔔 Отчёт в 08:00 — сюда».'
        )
      }
    }
  }

  await applyCommandsForChat(chatId, role)

  // Что на самом деле с отчётом — читаем из базы, а не обещаем
  const reportChat = await getReportChat(inv.company_id as string)
  const reportLine =
    reportChat === String(chatId)
      ? `🔔 Каждое утро в *08:00* сюда приходит отчёт за вчера.`
      : reportChat
        ? `🔔 Утренний отчёт по заведению сейчас приходит в другой чат. ` +
          `Чтобы получать его сюда — «🔔 Отчёт» → «Присылать отчёт сюда».`
        : `🔔 Утренний отчёт включается в разделе «🔔 Отчёт».`

  await sendMessage(chatId,
    `✅ *Готово, вы подключены*\n\n` +
    `🏪 *${escapeMd(company.name as string)}*\n\n` +
    `Здесь всё, что нужно, — сайт и приложение открывать не придётся:\n` +
    `• *📊 Сегодня* — сколько раз коснулись и куда перешли: Wi-Fi, бот, сайт, отзыв\n` +
    `• *📈 Статистика* — вчера, неделя, месяц\n` +
    `• *🏪 По точкам* — какая точка сколько принесла\n\n` +
    reportLine,
    { reply_markup: menuForRole(role) }
  )
}
