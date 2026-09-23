/**
 * lib/telegram/profile.ts
 *
 * Профиль бота в коде: имя, описания и наборы команд.
 *
 * Всё это обычно вбивают руками в BotFather и потом забывают обновить —
 * поэтому тексты лежат здесь, рядом с кодом, который их и применяет.
 * Кнопка «Настроить бота» в приложении вызывает configureBot(), и Telegram
 * получает актуальные данные за один заход.
 *
 * Команды разные для разных людей: гость видит витрину, клиент — отчёты,
 * супер-админ — заявки и рассылку. Telegram умеет это через scope, поэтому
 * после привязки аккаунта мы ставим персональный набор в его чат.
 */

import {
  setMyName, setMyShortDescription, setMyDescription,
  setMyCommands, setChatMenuButton, type BotCommand,
} from '@/lib/telegram/bot'

export const BOT_NAME = 'BirTapCard'

/** До 120 символов — карточка бота в профиле */
export const SHORT_DESCRIPTION =
  '⚡️ Отзыв в Google за одно касание. 📊 Тарифы, заявка, отчёты. 🆘 Поддержка: @birtapcard'

/** До 512 символов — экран до кнопки «Начать» */
export const DESCRIPTION = `🟢 BirTapCard — карточка на кассе вашего заведения.

📲 Гость подносит телефон и за 15 секунд оставляет отзыв в Google, Яндекс или 2ГИС, подписывается на ваш Instagram или Telegram. Без приложений и регистраций.

Что можно сделать здесь:
🚀 Узнать, как это работает
💳 Посмотреть тарифы и цены
📝 Оставить заявку на подключение
🆘 Написать в поддержку — @birtapcard

📊 Клиентам бот присылает ежедневный отчёт: касания, новые отзывы Google, рейтинг и лучшая точка.`

/** Гость: витрина и заявка */
export const GUEST_COMMANDS: BotCommand[] = [
  { command: 'start', description: 'Начать' },
  { command: 'about', description: 'Что такое BirTapCard' },
  { command: 'price', description: 'Тарифы и цены' },
  { command: 'order', description: 'Оставить заявку на подключение' },
  { command: 'support', description: 'Написать в поддержку' },
]

/** Клиент: отчёты, подписка, настройки */
export const CLIENT_COMMANDS: BotCommand[] = [
  { command: 'today', description: 'Отчёт за сегодня' },
  { command: 'yesterday', description: 'Отчёт за вчера' },
  { command: 'week', description: 'Отчёт за 7 дней' },
  { command: 'month', description: 'Отчёт за этот месяц' },
  { command: 'periods', description: 'Выбрать период' },
  { command: 'notify', description: 'Ежедневный отчёт: час и уведомления' },
  { command: 'subscription', description: 'Подписка и оплата' },
  { command: 'support', description: 'Написать в поддержку' },
  { command: 'settings', description: 'Настройки' },
  { command: 'help', description: 'Справка' },
]

/** Супер-админ: всё то же плюс управление платформой */
export const ADMIN_COMMANDS: BotCommand[] = [
  { command: 'stats', description: 'Статистика платформы' },
  { command: 'leads', description: 'Заявки из бота' },
  { command: 'support_inbox', description: 'Обращения в поддержку' },
  { command: 'companies', description: 'Компании и филиалы' },
  { command: 'broadcast', description: 'Рассылка клиентам' },
  { command: 'today', description: 'Отчёт за сегодня' },
  { command: 'help', description: 'Справка' },
]

export function commandsForRole(role: string | null | undefined): BotCommand[] {
  if (role === 'super_admin') return ADMIN_COMMANDS
  if (role === 'owner' || role === 'branch_manager') return CLIENT_COMMANDS
  return GUEST_COMMANDS
}

/** Персональный набор команд в конкретном чате — вызывается после привязки */
export async function applyCommandsForChat(chatId: number, role: string | null | undefined) {
  await setMyCommands(commandsForRole(role), { type: 'chat', chat_id: chatId })
}

export interface ConfigureResult { step: string; ok: boolean; error?: string }

/** Применить имя, описания, команды по умолчанию и кнопку меню */
export async function configureBot(): Promise<ConfigureResult[]> {
  const steps: [string, Promise<{ ok: boolean; error?: string }>][] = [
    ['Имя бота', setMyName(BOT_NAME)],
    ['Краткое описание', setMyShortDescription(SHORT_DESCRIPTION)],
    ['Описание', setMyDescription(DESCRIPTION)],
    ['Команды', setMyCommands(GUEST_COMMANDS, { type: 'all_private_chats' })],
    ['Кнопка меню', setChatMenuButton()],
  ]

  const out: ConfigureResult[] = []
  for (const [step, promise] of steps) {
    const res = await promise
    out.push({ step, ok: res.ok, error: res.error })
  }
  return out
}
