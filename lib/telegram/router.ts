/**
 * lib/telegram/router.ts
 *
 * Маршрутизация входящих message-апдейтов (текст, фото, документы).
 * Это единственное место, которое решает "что делать с сообщением" —
 * webhook route.ts остаётся тонким HTTP-слоем над этим модулем.
 *
 * Phase 1: меню и текстовые кнопки теперь зависят от роли пользователя
 * (super_admin / owner / branch_manager). Разделы, которых ещё нет
 * (см. план фаз), отвечают экраном "скоро" через comingSoon(), но кнопка
 * уже в меню — навигация не будет визуально меняться от фазы к фазе.
 */

import { sendMessage, keyboard } from '@/lib/telegram/bot'
import { findProfile, getState, isBuiltinAdmin, type BotProfile } from '@/lib/telegram/db'
import { menuForRole } from '@/lib/telegram/keyboards/menus'
import type { TgMessage } from '@/lib/telegram/types'
import { handleStart, handleLinkToken } from '@/lib/telegram/handlers/start'
import { handleReport, handleCustomRangeRequest, handleCustomRangeInput, CUSTOM_RANGE_STATE } from '@/lib/telegram/handlers/report'
import {
  handleSubscriptionMenu,
  handleReceiptUpload,
  isAwaitingReceipt,
} from '@/lib/telegram/handlers/subscription'
import { handleSettings, handleHelp } from '@/lib/telegram/handlers/settings'
import { handleMyBranches, handleBranchRankingMenu } from '@/lib/telegram/handlers/branches'
import { handleExportMenu } from '@/lib/telegram/handlers/export'
import { handleLeadsList } from '@/lib/telegram/handlers/leads'
import { handleNotifyMenu } from '@/lib/telegram/handlers/notify'
import { handleWifiInput, isWifiState } from '@/lib/telegram/handlers/wifi'
import { handleScreenInput, isScreenInputState } from '@/lib/telegram/handlers/screen'
import {
  handleSupportMenu, handleSupportInput, isWritingSupport, handleSupportInbox,
} from '@/lib/telegram/handlers/support'
import {
  handlePlatformStats, handleCompanies, handleCompanyPicker, handleBroadcastStart,
  handleBroadcastText, isComposingBroadcast,
} from '@/lib/telegram/handlers/platform'
import { handleAdminSubscriptions } from '@/lib/telegram/handlers/subscriptionsAdmin'
import { handleAdminPayments } from '@/lib/telegram/handlers/paymentsAdmin'
import { handleAdminUsers } from '@/lib/telegram/handlers/usersAdmin'
import { handleAdminBotControl } from '@/lib/telegram/handlers/botAdmin'
import {
  salesMenu,
  handleSalesStart,
  handleSalesWhat,
  handleSalesPlans,
  handleSalesContacts,
  handleLeadStart,
  handleLeadInput,
  isFillingLead,
} from '@/lib/telegram/handlers/sales'

/** Прежняя подпись кнопки «Заведения» у администратора — оставлена намеренно, не переименовывать */
const LEGACY_VENUES_BUTTON = '🍽 Рестораны'

const COMMAND_MAP: Record<string, string> = {
  '/today': 'today',
  '/yesterday': 'yesterday',
  '/week': '7d',
  '/month': 'month',
  '/report': 'today',
}

async function sendPeriodPicker(chatId: number) {
  await sendMessage(chatId, '📅 *Выберите период:*', {
    reply_markup: keyboard([
      [{ text: '📅 Сегодня', callback_data: 'report:today' }, { text: '📅 Вчера', callback_data: 'report:yesterday' }],
      [{ text: '📅 7 дней', callback_data: 'report:7d' }, { text: '📅 30 дней', callback_data: 'report:30d' }],
      [{ text: '📅 Этот месяц', callback_data: 'report:month' }, { text: '📅 Прошлый месяц', callback_data: 'report:prev_month' }],
      [{ text: '🗓 Свой период', callback_data: 'report:custom' }],
    ]),
  })
}

/**
 * Текстовая навигация для того, кто ещё не клиент: витрина и заявка.
 * Возвращает true, если сообщение было обработано.
 */
async function dispatchSalesText(chatId: number, telegramId: number, text: string): Promise<boolean> {
  if (text === '🚀 Что это' || text === '/about') {
    await handleSalesWhat(chatId)
    return true
  }
  if (text === '💳 Тарифы' || text === '/price' || text === '/plans') {
    await handleSalesPlans(chatId)
    return true
  }
  if (text === '📝 Оставить заявку' || text === '/order') {
    await handleLeadStart(chatId, telegramId)
    return true
  }
  if (text === '🆘 Связаться с нами' || text === '/contacts') {
    await handleSalesContacts(chatId)
    return true
  }
  if (text === '🆘 Поддержка' || text === '/support' || text === '/help') {
    await handleSupportMenu(chatId, telegramId)
    return true
  }
  return false
}

/**
 * Текстовая навигация для уже привязанного пользователя.
 * Возвращает true, если сообщение было обработано как пункт меню/команда.
 */
async function dispatchMenuText(chatId: number, telegramId: number, profile: BotProfile, text: string): Promise<boolean> {
  // ─── Общие для всех ролей ──────────────────────────────────────────────
  if (COMMAND_MAP[text] !== undefined) {
    await handleReport(chatId, telegramId, COMMAND_MAP[text])
    return true
  }

  if (text === '📅 Выбрать период' || text === '/periods') {
    await sendPeriodPicker(chatId)
    return true
  }

  if (text === '⚙️ Настройки' || text === '⚙ Настройки' || text === '/settings') {
    await handleSettings(chatId, telegramId)
    return true
  }

  if (text === '❓ Помощь' || text === 'ℹ Информация' || text === '/help') {
    await handleHelp(chatId)
    return true
  }

  // ─── "📈 Аналитика" неоднозначна: у owner это период, у super_admin — раздел Фазы 4 ──
  if (text === '📈 Аналитика') {
    if (profile.role === 'super_admin') {
      await handleCompanyPicker(chatId, '7d')
    } else {
      await sendPeriodPicker(chatId)
    }
    return true
  }

  // ─── Owner / Branch Manager ─────────────────────────────────────────────
  if (text === '📊 Сегодня') {
    await handleReport(chatId, telegramId, 'today')
    return true
  }

  if (text === '📈 Статистика') {
    await sendPeriodPicker(chatId)
    return true
  }

  if (text === '📄 Отчёт') {
    await handleReport(chatId, telegramId, 'today')
    return true
  }

  if (text === '💳 Подписка' || text === '💳 Подписка и оплата' || text === '/subscription' || text === '/pay') {
    await handleSubscriptionMenu(chatId, telegramId)
    return true
  }

  if (text === '📄 Скачать отчёт') {
    await handleExportMenu(chatId)
    return true
  }

  if (text === '🏪 Мои филиалы') {
    await handleMyBranches(chatId, telegramId)
    return true
  }

  // «🏪 По точкам» — рейтинг точек за выбранный период (то же, что «🏆 Рейтинг филиалов»)
  if (text === '🏆 Рейтинг филиалов' || text === '🏪 По точкам') {
    await handleBranchRankingMenu(chatId)
    return true
  }

  if (text === '🔥 Заявки' || text === '/leads') {
    if (profile.role === 'super_admin') {
      await handleLeadsList(chatId, telegramId)
    } else {
      await sendMessage(chatId, 'ℹ️ Раздел заявок доступен только администраторам платформы.')
    }
    return true
  }

  if (text === '🔔 Уведомления' || text === '🔔 Отчёт' || text === '/notify') {
    await handleNotifyMenu(chatId, telegramId)
    return true
  }

  if (text === '🆘 Поддержка' || text === '/support') {
    await handleSupportMenu(chatId, telegramId)
    return true
  }

  // ─── Super Admin ─────────────────────────────────────────────────────────
  if (profile.role === 'super_admin') {
    if (text === '📊 Статистика платформы' || text === '/stats') {
      await handlePlatformStats(chatId, telegramId)
      return true
    }
    // Прежние названия этой кнопки («Компании», «Рестораны») тоже принимаем: у людей
    // клавиатура в чате обновится только после /start
    if (text === '🏢 Заведения' || text === '🏢 Компании' || text === LEGACY_VENUES_BUTTON ||
        text === '🏪 Филиалы' || text === '/companies') {
      await handleCompanies(chatId, telegramId)
      return true
    }
    if (text === '📢 Рассылка' || text === '/broadcast') {
      await handleBroadcastStart(chatId, telegramId)
      return true
    }
    if (text === '/support_inbox' || text === '📩 Обращения') {
      await handleSupportInbox(chatId, telegramId)
      return true
    }
    if (text === '💳 Подписки' || text === '/subscriptions') {
      await handleAdminSubscriptions(chatId, telegramId)
      return true
    }
    if (text === '💰 Оплаты' || text === '📩 Новые чеки' || text === '/payments') {
      await handleAdminPayments(chatId, telegramId)
      return true
    }
    if (text === '👥 Пользователи' || text === '/users') {
      await handleAdminUsers(chatId, telegramId)
      return true
    }
    if (text === '🤖 Telegram' || text === '/bot') {
      await handleAdminBotControl(chatId, telegramId)
      return true
    }
  }

  return false
}

export async function handleMessage(msg: TgMessage) {
  const chatId = msg.chat.id
  const telegramId = msg.from?.id
  if (!telegramId) return

  // Загрузка чека: ждём фото/документ для активной заявки на оплату
  if ((msg.photo || msg.document) && (await isAwaitingReceipt(telegramId))) {
    await handleReceiptUpload(chatId, telegramId, msg)
    return
  }

  const text = (msg.text ?? '').trim()

  // Форма заявки: любой ввод (включая контакт) идёт в неё, пока она открыта.
  // Команды — кроме /cancel — из формы выпускаем, иначе «/start» станет
  // названием заведения и человек застрянет.
  const isCommand = text.startsWith('/') && text !== '/cancel'
  if (!isCommand) {
    if (await isFillingLead(telegramId)) {
      if (await handleLeadInput(chatId, telegramId, msg)) return
    }
    if (await isWritingSupport(telegramId)) {
      if (await handleSupportInput(chatId, telegramId, msg)) return
    }
    if (await isComposingBroadcast(telegramId)) {
      if (await handleBroadcastText(chatId, telegramId, text)) return
    }
  }

  // Ждём ввод: свой период с датами (Фаза 2) или название сети / пароль Wi-Fi заведения.
  // Для Wi-Fi пароль приходит обычным текстом, поэтому «/cancel» здесь тоже пропускаем.
  if (text && (!text.startsWith('/') || text === '/cancel')) {
    const state = await getState(telegramId)
    if (state?.state === CUSTOM_RANGE_STATE && !text.startsWith('/')) {
      await handleCustomRangeInput(chatId, telegramId, text)
      return
    }
    if (state && isWifiState(state.state)) {
      if (await handleWifiInput(chatId, telegramId, msg, state)) return
    }
    if (state && isScreenInputState(state.state)) {
      if (await handleScreenInput(chatId, telegramId, msg, state)) return
    }
  }

  // ─── /whoami — кто я для бота: ID, роль, есть ли админские права ────────
  if (text === '/whoami' || text === '/id') {
    const p = await findProfile(telegramId)
    await sendMessage(chatId,
      '🪪 *Кто вы для бота*\n\n' +
      `Telegram ID: \`${telegramId}\`\n` +
      `В списке администраторов: *${isBuiltinAdmin(telegramId) ? 'да' : 'нет'}*\n` +
      `Роль: *${p?.role ?? 'гость (аккаунт не привязан)'}*\n` +
      `Компания: *${p?.company_id ? 'привязана' : '—'}*`
    )
    return
  }

  // ─── /start ────────────────────────────────────────────────────────────
  if (text === '/start' || text.startsWith('/start ')) {
    const token = text.split(' ')[1]
    if (token) {
      await handleLinkToken(chatId, telegramId, msg.from!, token)
    } else {
      await handleStart(chatId, telegramId, msg.from?.first_name)
    }
    return
  }

  const profile = await findProfile(telegramId)

  // ─── Не привязан: воронка вместо тупика ──────────────────────────────────
  if (!profile) {
    if (await dispatchSalesText(chatId, telegramId, text)) return
    await sendMessage(chatId, 'Выберите, что показать 👇', { reply_markup: salesMenu() })
    return
  }

  // ─── Пункты меню / команды по роли ───────────────────────────────────────
  const handled = await dispatchMenuText(chatId, telegramId, profile, text)
  if (handled) return

  // ─── Неизвестное сообщение ────────────────────────────────────────────────
  await sendMessage(chatId,
    'Не понял команду 🤔 Используйте кнопки меню ниже.',
    { reply_markup: menuForRole(profile.role) }
  )
}
