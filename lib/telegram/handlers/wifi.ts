/**
 * lib/telegram/handlers/wifi.ts
 *
 * «📶 Wi-Fi на карточке» — раздел карточки заведения у супер-админа.
 * Сеть и пароль вводятся здесь, в боте, и сразу появляются на экране гостя
 * (карточка «Wi-Fi» → окно с названием сети и паролем). Хранятся в venue_wifi
 * (миграция 0009), в переменные окружения лезть не нужно.
 *
 * Пароль в чате не остаётся: сообщение с ним бот удаляет сразу после чтения,
 * в самом боте пароль никогда не показывается — только «задан».
 *
 * Ввод идёт в два шага через bot_state: название сети → пароль («-» — без пароля).
 * Пароль между шагами нигде не лежит: в состоянии хранится только название сети.
 */

import { sendMessage, deleteMessage, keyboard, escapeMd, type InlineButton } from '@/lib/telegram/bot'
import { db, findProfile, setState, clearState } from '@/lib/telegram/db'
import { navRow } from '@/lib/telegram/keyboards/main'
import { menuForRole } from '@/lib/telegram/keyboards/menus'
import { siteUrl } from '@/lib/telegram/handlers/branches'
import { pdpWifiFromEnv } from '@/lib/screens/pdp-school'
import {
  readVenueWifi, saveVenueWifi, deleteVenueWifi, parseWifiSsid, parseWifiPassword,
  venueSupportsWifi, WIFI_SSID_MAX_BYTES,
} from '@/lib/venue-wifi'
import type { TgMessage } from '@/lib/telegram/types'

export const WIFI_SSID_STATE = 'wifi_ssid'
export const WIFI_PASS_STATE = 'wifi_pass'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CANCEL_LABEL = '❌ Отменить'
const cancelKeyboard = { keyboard: [[{ text: CANCEL_LABEL }]], resize_keyboard: true, one_time_keyboard: true }

const MIGRATION_HINT =
  'Скорее всего, не выполнена миграция 0009_venue_wifi.sql — запустите её в Supabase (SQL Editor).'

export function isWifiState(state: string | null | undefined): boolean {
  return state === WIFI_SSID_STATE || state === WIFI_PASS_STATE
}

function backRow(companyId: string) {
  return [{ text: '🔙 К заведению', callback_data: `co:${companyId}:7d` }]
}

async function companyName(companyId: string): Promise<string | null> {
  const { data } = await db().from('companies').select('name').eq('id', companyId).maybeSingle()
  return (data?.name as string | undefined) ?? null
}

/** Ссылка «как это видит гость»: экран карточки первой активной точки (скан при этом не пишется) */
async function guestPreviewUrl(companyId: string): Promise<string | null> {
  const { data } = await db()
    .from('branches').select('nfc_token').eq('company_id', companyId).eq('active', true).order('name').limit(1)
  const token = data?.[0]?.nfc_token as string | undefined
  return token ? `${siteUrl()}/r/go/${token}` : null
}

/** Экран «📶 Wi-Fi»: что сейчас стоит на карточке и что можно сделать */
export async function sendWifiScreen(chatId: number, companyId: string) {
  if (!UUID.test(companyId)) {
    await sendMessage(chatId, '⚠️ Не понял, какое заведение.', { reply_markup: keyboard([navRow('platform:companies')]) })
    return
  }
  const supabase = db()
  const name = await companyName(companyId)
  if (!name) {
    await sendMessage(chatId, '⚠️ Заведение не найдено.', { reply_markup: keyboard([navRow('platform:companies')]) })
    return
  }
  if (!venueSupportsWifi(name)) {
    await sendMessage(chatId,
      `📶 У экрана «${escapeMd(name)}» пока нет карточки Wi-Fi — она есть у PDP School.`,
      { reply_markup: keyboard([backRow(companyId), navRow()]) }
    )
    return
  }

  const { wifi, error } = await readVenueWifi(supabase, companyId)
  if (error) {
    await sendMessage(chatId,
      `❌ *Wi-Fi · ${escapeMd(name)}*\n\nНе удалось прочитать настройку. ${MIGRATION_HINT}`,
      { reply_markup: keyboard([backRow(companyId), navRow()]) }
    )
    return
  }

  const rows: InlineButton[][] = []
  let body: string

  if (wifi) {
    body =
      `📶 *Wi-Fi · ${escapeMd(name)}*\n\n` +
      `Сеть: *${escapeMd(wifi.ssid)}*\n` +
      `Пароль: ${wifi.password ? 'задан ✅ _(в боте не показывается)_' : 'нет — сеть открытая'}\n\n` +
      `Гость нажимает на карточку «Wi-Fi» на экране ссылок и видит сеть и пароль — их можно скопировать.`
    rows.push([
      { text: '✏️ Изменить', callback_data: `co:${companyId}:wifiset` },
      { text: '🗑 Убрать карточку', callback_data: `co:${companyId}:wifidel` },
    ])
  } else {
    const env = pdpWifiFromEnv()
    body =
      `📶 *Wi-Fi · ${escapeMd(name)}*\n\n` +
      (env
        ? `Сейчас карточка берёт сеть из переменной окружения: *${escapeMd(env.ssid)}*. ` +
          `Задайте её здесь — и переменные в Vercel больше не нужны.`
        : `Сейчас карточки Wi-Fi на экране нет — гости её не видят.\n` +
          `Задайте название сети и пароль — карточка появится сразу.`)
    rows.push([{ text: '➕ Задать Wi-Fi', callback_data: `co:${companyId}:wifiset` }])
  }

  const preview = await guestPreviewUrl(companyId)
  if (preview) rows.push([{ text: '👁 Как это видит гость', url: preview }])
  rows.push(backRow(companyId))
  rows.push(navRow())

  await sendMessage(chatId, body, { reply_markup: keyboard(rows) })
}

/** «➕ Задать / ✏️ Изменить»: первый шаг — название сети */
export async function startWifiEdit(chatId: number, telegramId: number, companyId: string) {
  const name = await companyName(companyId)
  if (!name || !venueSupportsWifi(name)) {
    await sendWifiScreen(chatId, companyId)
    return
  }
  await setState(telegramId, WIFI_SSID_STATE, { company_id: companyId })
  await sendMessage(chatId,
    `📶 *Wi-Fi · ${escapeMd(name)}*\n\n` +
    `Напишите *название сети* — так, как гость увидит её в настройках телефона.`,
    { reply_markup: cancelKeyboard }
  )
}

/** «🗑 Убрать карточку»: сначала спрашиваем — карточка пропадёт у гостей сразу */
export async function askWifiRemove(chatId: number, companyId: string) {
  const name = await companyName(companyId)
  await sendMessage(chatId,
    `🗑 *Убрать карточку Wi-Fi?*\n🏢 ${escapeMd(name ?? '')}\n\n` +
    `Гости перестанут видеть Wi-Fi на экране ссылок. Сеть и пароль будут удалены — потом их придётся ввести заново.`,
    {
      reply_markup: keyboard([
        [{ text: '✅ Да, убрать', callback_data: `co:${companyId}:wifidelok` }],
        [{ text: '🔙 Оставить', callback_data: `co:${companyId}:wifi` }],
      ]),
    }
  )
}

export async function removeWifi(chatId: number, companyId: string) {
  const res = await deleteVenueWifi(db(), companyId)
  if (!res.ok) {
    console.error('venue_wifi delete error:', res.error)
    await sendMessage(chatId, `❌ Не удалось убрать. ${MIGRATION_HINT}`, { reply_markup: keyboard([backRow(companyId), navRow()]) })
    return
  }
  await sendMessage(chatId,
    '✅ Карточка Wi-Fi убрана — гости её больше не видят.',
    { reply_markup: keyboard([[{ text: '➕ Задать заново', callback_data: `co:${companyId}:wifiset` }], backRow(companyId), navRow()]) }
  )
}

/**
 * Ввод названия сети и пароля. Возвращает true, если сообщение обработано.
 * state — то, что уже прочитал роутер (чтобы не ходить в базу второй раз).
 */
export async function handleWifiInput(
  chatId: number,
  telegramId: number,
  msg: TgMessage,
  state: { state: string; payload: Record<string, unknown> | null }
): Promise<boolean> {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    // Состояние осталось от прежней роли — снимаем его и отдаём сообщение обычному разбору
    await clearState(telegramId)
    return false
  }

  const text = (msg.text ?? '').trim()
  const isPassStep = state.state === WIFI_PASS_STATE
  const companyId = state.payload?.company_id
  if (typeof companyId !== 'string' || !UUID.test(companyId)) {
    await clearState(telegramId)
    await sendMessage(chatId, '⚠️ Не понял, для какого заведения. Откройте заведение и нажмите «📶 Wi-Fi» ещё раз.', {
      reply_markup: menuForRole(profile.role),
    })
    return true
  }

  if (text === CANCEL_LABEL || text === '/cancel') {
    await clearState(telegramId)
    if (isPassStep && msg.message_id) await deleteMessage(chatId, msg.message_id)
    await sendMessage(chatId, 'Отменено.', { reply_markup: menuForRole(profile.role) })
    await sendWifiScreen(chatId, companyId)
    return true
  }

  // Шаг 2 — пароль: убираем сообщение из чата до любой другой обработки
  if (isPassStep && msg.message_id) await deleteMessage(chatId, msg.message_id)

  if (!text) {
    await sendMessage(chatId,
      isPassStep ? 'Пришлите пароль текстом (или «-», если сети без пароля).' : 'Пришлите название сети текстом.',
      { reply_markup: cancelKeyboard }
    )
    return true
  }

  if (!isPassStep) {
    const parsed = parseWifiSsid(text)
    if (!parsed.ok) {
      await sendMessage(chatId, `⚠️ ${parsed.reason}\nНапишите название ещё раз (до ${WIFI_SSID_MAX_BYTES} байт).`, {
        reply_markup: cancelKeyboard,
      })
      return true
    }
    await setState(telegramId, WIFI_PASS_STATE, { company_id: companyId, ssid: parsed.ssid })
    await sendMessage(chatId,
      `📶 Сеть: *${escapeMd(parsed.ssid)}*\n\n` +
      `Теперь *пароль*. Если сеть открытая и пароля нет — отправьте «-».\n\n` +
      `_Сообщение с паролем я сразу удалю из чата._`,
      { reply_markup: cancelKeyboard }
    )
    return true
  }

  const ssid = state.payload?.ssid
  if (typeof ssid !== 'string' || !ssid) {
    await setState(telegramId, WIFI_SSID_STATE, { company_id: companyId })
    await sendMessage(chatId, 'Название сети потерялось — напишите его ещё раз.', { reply_markup: cancelKeyboard })
    return true
  }

  const parsed = parseWifiPassword(text)
  if (!parsed.ok) {
    await sendMessage(chatId, `⚠️ ${parsed.reason}\nНапишите пароль ещё раз (или «-» — без пароля).`, {
      reply_markup: cancelKeyboard,
    })
    return true
  }

  const res = await saveVenueWifi(db(), companyId, { ssid, password: parsed.password }, telegramId)
  await clearState(telegramId)
  if (!res.ok) {
    console.error('venue_wifi save error:', res.error)
    await sendMessage(chatId, `❌ Не удалось сохранить. ${MIGRATION_HINT}`, { reply_markup: menuForRole(profile.role) })
    return true
  }

  // Клавиатуру «Отменить» возвращаем к обычному меню, затем показываем итог с кнопками
  await sendMessage(chatId, '✅ Сохранено. Карточка Wi-Fi уже на экране гостя.', { reply_markup: menuForRole(profile.role) })
  await sendWifiScreen(chatId, companyId)
  return true
}
