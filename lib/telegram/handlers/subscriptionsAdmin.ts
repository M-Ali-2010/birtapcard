/**
 * lib/telegram/handlers/subscriptionsAdmin.ts
 *
 * Управление подписками заведений и филиалов для super_admin прямо из Telegram.
 * Показывает активные, истекающие и просроченные подписки,
 * и позволяет продлевать срок (+1, +3, +6, +12 мес.) в один клик.
 */

import { sendMessage, answerCallback, keyboard, escapeMd, type InlineButton } from '@/lib/telegram/bot'
import { db, findProfile } from '@/lib/telegram/db'
import { navRow } from '@/lib/telegram/keyboards/main'

export async function handleAdminSubscriptions(chatId: number, telegramId: number, filter = 'all') {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    await sendMessage(chatId, '⛔ Раздел доступен только администраторам.')
    return
  }

  const supabase = db()
  const { data: branches, error } = await supabase
    .from('branches')
    .select('id, name, company_id, paid_until, active, companies(id, name)')
    .order('name')

  if (error || !branches) {
    await sendMessage(chatId, '❌ Не удалось загрузить список филиалов.')
    return
  }

  const now = Date.now()
  const weekMs = 7 * 86400000

  let activeCount = 0
  let expiringCount = 0
  let expiredCount = 0

  const items = branches.map(b => {
    const paidUntil = b.paid_until ? new Date(b.paid_until).getTime() : null
    let state: 'active' | 'expiring' | 'expired' = 'expired'
    let daysLeft = 0

    if (paidUntil) {
      const diff = paidUntil - now
      daysLeft = Math.ceil(diff / 86400000)
      if (diff > weekMs) {
        state = 'active'
        activeCount++
      } else if (diff > 0) {
        state = 'expiring'
        expiringCount++
      } else {
        state = 'expired'
        expiredCount++
      }
    } else {
      expiredCount++
    }

    const companyName = Array.isArray(b.companies)
      ? b.companies[0]?.name
      : (b.companies as { name?: string } | null)?.name || 'Заведение'

    return {
      id: b.id,
      name: b.name,
      companyName,
      paidUntil: b.paid_until,
      state,
      daysLeft,
    }
  })

  // Фильтрация
  const filtered = items.filter(i => {
    if (filter === 'expiring') return i.state === 'expiring'
    if (filter === 'expired') return i.state === 'expired'
    return true
  })

  const filterRow: InlineButton[] = [
    { text: filter === 'all' ? '• Все' : 'Все', callback_data: 'sub_adm:f:all' },
    { text: filter === 'expiring' ? '• ⚠️ Истекают' : '⚠️ Истекают', callback_data: 'sub_adm:f:expiring' },
    { text: filter === 'expired' ? '• ❌ Истекли' : '❌ Истекли', callback_data: 'sub_adm:f:expired' },
  ]

  let text = `💳 *Подписки клиентов*\n\n` +
    `🏪 Всего точек: *${branches.length}*\n` +
    `✅ Активных: *${activeCount}*\n` +
    `⚠️ Истекают (≤ 7 дн.): *${expiringCount}*\n` +
    `❌ Истекли / без срока: *${expiredCount}*\n\n`

  if (!filtered.length) {
    text += `_В этом фильтре точек нет._`
    await sendMessage(chatId, text, { reply_markup: keyboard([filterRow, navRow()]) })
    return
  }

  text += `*Список точек:*`

  // Кнопки по точкам для быстрого продления
  const branchButtons: InlineButton[][] = filtered.slice(0, 15).map(item => {
    const icon = item.state === 'active' ? '✅' : item.state === 'expiring' ? '⚠️' : '❌'
    const daysLabel = item.daysLeft > 0 ? `${item.daysLeft} дн.` : 'истекла'
    return [{
      text: `${icon} ${item.name} (${item.companyName}) · ${daysLabel}`,
      callback_data: `sub_adm:view:${item.id}`,
    }]
  })

  await sendMessage(chatId, text, {
    reply_markup: keyboard([
      filterRow,
      ...branchButtons,
      navRow(),
    ]),
  })
}

/** Детальная карточка подписки филиала с кнопками продления */
export async function handleAdminBranchSubDetail(chatId: number, telegramId: number, branchId: string) {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') return

  const supabase = db()
  const { data: b } = await supabase
    .from('branches')
    .select('id, name, company_id, paid_until, active, companies(name)')
    .eq('id', branchId)
    .single()

  if (!b) {
    await sendMessage(chatId, '❌ Филиал не найден.')
    return
  }

  const companyName = Array.isArray(b.companies)
    ? b.companies[0]?.name
    : (b.companies as { name?: string } | null)?.name || 'Заведение'

  const paidUntilStr = b.paid_until
    ? new Date(b.paid_until).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'не задан'

  const now = Date.now()
  const daysLeft = b.paid_until ? Math.ceil((new Date(b.paid_until).getTime() - now) / 86400000) : 0
  const isExpired = daysLeft <= 0

  const statusText = !b.paid_until
    ? '❌ Без срока'
    : isExpired
      ? `❌ Истекла (${Math.abs(daysLeft)} дн. назад)`
      : `✅ Активна (осталось ${daysLeft} дн.)`

  const text = `💳 *Подписка филиала*\n\n` +
    `🏪 Точка: *${escapeMd(b.name)}*\n` +
    `🏢 Заведение: *${escapeMd(companyName)}*\n` +
    `📅 Действует до: *${paidUntilStr}*\n` +
    `Статус: ${statusText}\n\n` +
    `_Выберите, на сколько продлить подписку:_`

  const buttons: InlineButton[][] = [
    [
      { text: '+1 месяц', callback_data: `sub_adm:ext:${b.id}:1` },
      { text: '+3 месяца', callback_data: `sub_adm:ext:${b.id}:3` },
    ],
    [
      { text: '+6 месяцев', callback_data: `sub_adm:ext:${b.id}:6` },
      { text: '+1 год (12 мес)', callback_data: `sub_adm:ext:${b.id}:12` },
    ],
    [
      { text: '🔙 К списку подписок', callback_data: 'sub_adm:f:all' },
    ],
  ]

  await sendMessage(chatId, text, { reply_markup: keyboard(buttons) })
}

/** Продление подписки филиала на указанное число месяцев */
export async function handleAdminExtendSub(callbackId: string, chatId: number, telegramId: number, arg: string) {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    await answerCallback(callbackId, '⛔ Нет доступа', true)
    return
  }

  const [branchId, monthsStr] = arg.split(':')
  const months = parseInt(monthsStr || '1', 10)

  const supabase = db()
  const { data: b } = await supabase
    .from('branches')
    .select('id, name, paid_until')
    .eq('id', branchId)
    .single()

  if (!b) {
    await answerCallback(callbackId, '❌ Филиал не найден', true)
    return
  }

  const now = new Date()
  const base = b.paid_until && new Date(b.paid_until) > now ? new Date(b.paid_until) : now
  const newPaidUntil = new Date(base)
  newPaidUntil.setMonth(newPaidUntil.getMonth() + months)

  const { error } = await supabase
    .from('branches')
    .update({ paid_until: newPaidUntil.toISOString() })
    .eq('id', branchId)

  if (error) {
    await answerCallback(callbackId, '❌ Ошибка при продлении', true)
    return
  }

  const dateFormatted = newPaidUntil.toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  await answerCallback(callbackId, `✅ Продлено на ${months} мес.`)
  await sendMessage(chatId,
    `✅ Подписка для *${escapeMd(b.name)}* продлена на *${months} мес.*!\n` +
    `📅 Новый срок действия: *${dateFormatted}*`
  )

  // Возвращаем обновленную карточку
  await handleAdminBranchSubDetail(chatId, telegramId, branchId)
}
