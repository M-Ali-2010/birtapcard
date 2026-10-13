/**
 * lib/telegram/keyboards/menus.ts
 *
 * Главные Reply-меню под каждую роль. Это то, что пользователь видит
 * постоянно внизу экрана после /start — единственный источник истины
 * для состава кнопок каждой роли.
 *
 * Разделы, помеченные как "coming soon" в router.ts, наполнятся реальной
 * логикой в следующих фазах (2: owner, 4: super_admin, 5: уведомления,
 * 6: поддержка) — кнопки уже на месте, чтобы навигация не менялась
 * визуально между фазами.
 */

import type { ReplyMarkup } from '@/lib/telegram/bot'
import type { BotProfile } from '@/lib/telegram/db'

export function superAdminMenu(): ReplyMarkup {
  return {
    keyboard: [
      [{ text: '📊 Статистика платформы' }, { text: '🏢 Заведения' }],
      [{ text: '🏪 Филиалы' }, { text: '👥 Пользователи' }],
      [{ text: '💳 Подписки' }, { text: '💰 Оплаты' }],
      [{ text: '📩 Обращения' }, { text: '🔥 Заявки' }],
      [{ text: '📢 Рассылка' }, { text: '🤖 Telegram' }],
      [{ text: '📈 Аналитика' }, { text: '⚙ Настройки' }],
    ],
    resize_keyboard: true,
    persistent: true,
  }
}

/**
 * Директор заведения (owner): только цифры — сколько касаний, куда перешли
 * (Wi-Fi, бот, сайт…) и утренний отчёт. Ссылки точек, подписка и выгрузки
 * из клавиатуры убраны; подписка и оплата по-прежнему доступны командой /subscription.
 */
export function ownerMenu(): ReplyMarkup {
  return {
    keyboard: [
      [{ text: '📊 Сегодня' }, { text: '📈 Статистика' }],
      [{ text: '🏪 По точкам' }, { text: '🔔 Отчёт' }],
      [{ text: '🆘 Поддержка' }],
    ],
    resize_keyboard: true,
    persistent: true,
  }
}

export function branchMenu(): ReplyMarkup {
  return {
    keyboard: [
      [{ text: '📊 Сегодня' }, { text: '📈 Статистика' }],
      [{ text: '📄 Отчёт' }, { text: 'ℹ Информация' }],
    ],
    resize_keyboard: true,
    persistent: true,
  }
}

/** Единая точка выбора меню по роли — используется во всех handlers/router */
export function menuForRole(role: BotProfile['role'] | undefined | null): ReplyMarkup {
  if (role === 'super_admin') return superAdminMenu()
  if (role === 'branch_manager') return branchMenu()
  return ownerMenu()
}
