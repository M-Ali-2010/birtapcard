/**
 * lib/telegram/handlers/screen.ts
 *
 * Экран заведения в боте, у супер-админа (карточка заведения):
 *   · «🖼 Ссылки на экране» — отзыв, сайт, бот, канал, Instagram, Google Play, App Store:
 *     нажать пункт → прислать новую ссылку (для Telegram и Instagram достаточно @имени,
 *     «-» — вернуть значение по умолчанию). Хранится в venue_links (миграция 0010);
 *   · «➕ Новая точка» — название → точка с готовыми NFC- и QR-ссылками.
 *
 * Ввод идёт через bot_state: одно состояние на администратора, как у Wi-Fi.
 */

import { randomBytes, randomUUID } from 'crypto'
import { sendMessage, keyboard, escapeMd, type InlineButton } from '@/lib/telegram/bot'
import { db, findProfile, setState, clearState } from '@/lib/telegram/db'
import { navRow } from '@/lib/telegram/keyboards/main'
import { menuForRole } from '@/lib/telegram/keyboards/menus'
import { sendBranchLinks, siteUrl } from '@/lib/telegram/handlers/branches'
import { PDP_SCHOOL_LINKS, PDP_ECOSYSTEM_LINKS } from '@/lib/screens/pdp-school'
import {
  LINK_KEYS, readVenueLinks, saveVenueLink, resetVenueLink, parseLinkInput, venueHasLinksScreen,
  type LinkKey,
} from '@/lib/venue-links'
import { extractPlaceId } from '@/lib/google-places'
import { slugify } from '@/lib/format'
import type { TgMessage } from '@/lib/telegram/types'

export const LINK_EDIT_STATE = 'link_edit'
export const POINT_NAME_STATE = 'point_name'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CANCEL_LABEL = '❌ Отменить'
const cancelKeyboard = { keyboard: [[{ text: CANCEL_LABEL }]], resize_keyboard: true, one_time_keyboard: true }

const MIGRATION_HINT =
  'Скорее всего, не выполнена миграция 0010_venue_links.sql — запустите её в Supabase (SQL Editor).'

export function isScreenInputState(state: string | null | undefined): boolean {
  return state === LINK_EDIT_STATE || state === POINT_NAME_STATE
}

const LABELS: Record<LinkKey, { icon: string; title: string; hint: string }> = {
  review:    { icon: '⭐', title: 'Отзыв (адрес)',   hint: 'ссылка на форму отзыва Google (search.google.com/local/writereview?placeid=…)' },
  website:   { icon: '🌐', title: 'Сайт',            hint: 'адрес сайта' },
  bot:       { icon: '🤖', title: 'Telegram-бот',    hint: 'ссылка t.me/… или просто @имя бота' },
  channel:   { icon: '📣', title: 'Telegram-канал',  hint: 'ссылка t.me/… или просто @имя канала' },
  instagram: { icon: '📸', title: 'Instagram',       hint: 'ссылка на профиль или просто @имя' },
  play:      { icon: '▶️', title: 'Google Play',     hint: 'ссылка на приложение в Google Play' },
  ios:       { icon: '🍎', title: 'App Store',       hint: 'ссылка на приложение в App Store' },
}

/** Что показывает экран, пока ссылка не задана вручную */
const DEFAULTS: Record<LinkKey, string> = {
  review: PDP_SCHOOL_LINKS.review,
  website: PDP_SCHOOL_LINKS.web.uz,
  bot: PDP_ECOSYSTEM_LINKS.bot,
  channel: PDP_ECOSYSTEM_LINKS.channel,
  instagram: PDP_ECOSYSTEM_LINKS.instagram,
  play: PDP_SCHOOL_LINKS.play,
  ios: PDP_SCHOOL_LINKS.ios,
}

function backRow(companyId: string) {
  return [{ text: '🔙 К заведению', callback_data: `co:${companyId}:7d` }]
}

async function companyName(companyId: string): Promise<string | null> {
  const { data } = await db().from('companies').select('name').eq('id', companyId).maybeSingle()
  return (data?.name as string | undefined) ?? null
}

function isLinkKey(v: string): v is LinkKey {
  return (LINK_KEYS as readonly string[]).includes(v)
}

// ─── Ссылки экрана ───────────────────────────────────────────────────────────

/** Экран «🖼 Ссылки на экране»: текущие значения и кнопка на каждый пункт */
export async function sendLinksScreen(chatId: number, companyId: string) {
  if (!UUID.test(companyId)) {
    await sendMessage(chatId, '⚠️ Не понял, какое заведение.', { reply_markup: keyboard([navRow('platform:companies')]) })
    return
  }
  const name = await companyName(companyId)
  if (!name) {
    await sendMessage(chatId, '⚠️ Заведение не найдено.', { reply_markup: keyboard([navRow('platform:companies')]) })
    return
  }
  if (!venueHasLinksScreen(name)) {
    await sendMessage(chatId,
      `🖼 У экрана «${escapeMd(name)}» нет настраиваемых ссылок — они есть у экрана PDP.`,
      { reply_markup: keyboard([backRow(companyId), navRow()]) }
    )
    return
  }

  const { links, error } = await readVenueLinks(db(), companyId)
  if (error) {
    await sendMessage(chatId,
      `❌ *Ссылки экрана · ${escapeMd(name)}*\n\nНе удалось прочитать. ${MIGRATION_HINT}`,
      { reply_markup: keyboard([backRow(companyId), navRow()]) }
    )
    return
  }

  const lines = LINK_KEYS.map(key => {
    const l = LABELS[key]
    const own = links[key]
    return `${l.icon} *${l.title}*\n\`${own ?? DEFAULTS[key]}\`${own ? '' : ' _(по умолчанию)_'}`
  })

  const rows: InlineButton[][] = []
  for (let i = 0; i < LINK_KEYS.length; i += 2) {
    rows.push(LINK_KEYS.slice(i, i + 2).map(key => ({
      text: `${LABELS[key].icon} ${LABELS[key].title}`,
      callback_data: `co:${companyId}:lk:${key}`,
    })))
  }
  rows.push([{ text: '👁 Как это видит гость', url: `${siteUrl()}/pdp/links` }])
  rows.push(backRow(companyId))
  rows.push(navRow())

  await sendMessage(chatId,
    `🖼 *Ссылки на экране · ${escapeMd(name)}*\n\n${lines.join('\n\n')}\n\n` +
    `_Нажмите пункт, чтобы изменить. Wi-Fi — на карточке заведения («📶 Wi-Fi на карточке»)._`,
    { reply_markup: keyboard(rows) }
  )
}

/** Нажали пункт: просим новую ссылку */
export async function startLinkEdit(chatId: number, telegramId: number, companyId: string, rawKey: string) {
  const name = await companyName(companyId)
  if (!name || !venueHasLinksScreen(name) || !isLinkKey(rawKey)) {
    await sendLinksScreen(chatId, companyId)
    return
  }
  const key = rawKey
  const { links } = await readVenueLinks(db(), companyId)
  const l = LABELS[key]
  await setState(telegramId, LINK_EDIT_STATE, { company_id: companyId, key })
  await sendMessage(chatId,
    `✏️ *${l.title}* · ${escapeMd(name)}\n\n` +
    `Сейчас: \`${links[key] ?? DEFAULTS[key]}\`${links[key] ? '' : ' _(по умолчанию)_'}\n\n` +
    `Пришлите новую ссылку — ${escapeMd(l.hint)}.\n` +
    `«-» — вернуть значение по умолчанию.`,
    { reply_markup: cancelKeyboard }
  )
}

// ─── Новая точка ─────────────────────────────────────────────────────────────

export async function startAddPoint(chatId: number, telegramId: number, companyId: string) {
  const name = await companyName(companyId)
  if (!name) {
    await sendMessage(chatId, '⚠️ Заведение не найдено.', { reply_markup: keyboard([navRow('platform:companies')]) })
    return
  }
  await setState(telegramId, POINT_NAME_STATE, { company_id: companyId })
  await sendMessage(chatId,
    `➕ *Новая точка · ${escapeMd(name)}*\n\n` +
    `Напишите название точки — например, «Ресепшн» или «Кассовая зона». ` +
    `Я создам её и сразу пришлю ссылки для NFC-метки и QR-наклейки.`,
    { reply_markup: cancelKeyboard }
  )
}

/** Ссылка на отзыв для новой точки: заданная в боте → у соседней точки → значение PDP */
async function reviewLinkFor(companyId: string, companyNameValue: string): Promise<{ url: string | null; paidUntil: string | null }> {
  const supabase = db()
  const { links } = await readVenueLinks(supabase, companyId)
  const { data: siblings } = await supabase
    .from('branches').select('google_url, paid_until').eq('company_id', companyId).order('created_at', { ascending: true }).limit(1)
  const first = siblings?.[0] as { google_url?: string | null; paid_until?: string | null } | undefined
  const url = links.review ?? first?.google_url ?? (venueHasLinksScreen(companyNameValue) ? PDP_SCHOOL_LINKS.review : null)
  return { url: url ?? null, paidUntil: first?.paid_until ?? null }
}

async function createPoint(chatId: number, companyId: string, rawName: string): Promise<boolean> {
  const supabase = db()
  const cname = await companyName(companyId)
  if (!cname) {
    await sendMessage(chatId, '⚠️ Заведение не найдено.', { reply_markup: keyboard([navRow('platform:companies')]) })
    return false
  }
  const pointName = rawName.trim().replace(/\s+/g, ' ')
  const { url, paidUntil } = await reviewLinkFor(companyId, cname)
  if (!url) {
    await sendMessage(chatId,
      '⚠️ Не знаю, какую ссылку на отзыв дать новой точке: у заведения нет ни одной точки со ссылкой. ' +
      'Создайте первую точку в кабинете.',
      { reply_markup: keyboard([backRow(companyId), navRow()]) }
    )
    return false
  }

  // Слаг, как в кабинете (транслитерация), плюс короткий хвост: слаги не должны совпасть
  const slug = `${slugify(pointName) || 'point'}-${randomBytes(2).toString('hex')}`
  const { data, error } = await supabase.from('branches').insert({
    company_id: companyId,
    name: pointName,
    slug,
    google_url: url,
    google_place_id: extractPlaceId(url),
    instagram_url: null, yandex_url: null, gis_url: null, telegram_url: null, bot_url: null,
    paid_until: paidUntil,
    nfc_token: randomUUID(),
    qr_token: randomUUID(),
    qr_image_url: null,
    active: true,
  }).select('id').single()

  if (error || !data) {
    console.error('branches insert (bot) error:', error)
    await sendMessage(chatId, `❌ Не удалось создать точку: ${escapeMd(error?.message ?? 'неизвестная ошибка')}`, {
      reply_markup: keyboard([backRow(companyId), navRow()]),
    })
    return false
  }

  await sendMessage(chatId,
    `✅ Точка *${escapeMd(pointName)}* создана в *${escapeMd(cname)}*.\n` +
    `Ссылки ниже — их записывают в NFC-метку и печатают на QR-наклейке.`
  )
  await sendBranchLinks(chatId, companyId, { branchId: data.id as string, back: `co:${companyId}:7d` })
  return true
}

// ─── Ввод ────────────────────────────────────────────────────────────────────

/** Обрабатывает текст, когда администратор вводит ссылку или название точки. true — сообщение обработано. */
export async function handleScreenInput(
  chatId: number,
  telegramId: number,
  msg: TgMessage,
  state: { state: string; payload: Record<string, unknown> | null }
): Promise<boolean> {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    await clearState(telegramId)
    return false
  }

  const text = (msg.text ?? '').trim()
  const companyId = state.payload?.company_id
  if (typeof companyId !== 'string' || !UUID.test(companyId)) {
    await clearState(telegramId)
    await sendMessage(chatId, '⚠️ Не понял, для какого заведения. Откройте заведение и начните заново.', {
      reply_markup: menuForRole(profile.role),
    })
    return true
  }

  if (text === CANCEL_LABEL || text === '/cancel') {
    await clearState(telegramId)
    await sendMessage(chatId, 'Отменено.', { reply_markup: menuForRole(profile.role) })
    if (state.state === LINK_EDIT_STATE) await sendLinksScreen(chatId, companyId)
    else await sendMessage(chatId, 'Вернуться к заведению:', { reply_markup: keyboard([backRow(companyId), navRow()]) })
    return true
  }

  if (!text) {
    await sendMessage(chatId, 'Пришлите текстом.', { reply_markup: cancelKeyboard })
    return true
  }

  // ── Новая точка ──
  if (state.state === POINT_NAME_STATE) {
    if (text.length < 2 || text.length > 60) {
      await sendMessage(chatId, '⚠️ Название — от 2 до 60 символов. Напишите ещё раз.', { reply_markup: cancelKeyboard })
      return true
    }
    await clearState(telegramId)
    await sendMessage(chatId, 'Создаю точку…', { reply_markup: menuForRole(profile.role) })
    await createPoint(chatId, companyId, text)
    return true
  }

  // ── Ссылка экрана ──
  const key = state.payload?.key
  if (typeof key !== 'string' || !isLinkKey(key)) {
    await clearState(telegramId)
    await sendLinksScreen(chatId, companyId)
    return true
  }

  if (text === '-') {
    const res = await resetVenueLink(db(), companyId, key)
    await clearState(telegramId)
    if (!res.ok) {
      console.error('venue_links reset error:', res.error)
      await sendMessage(chatId, `❌ Не удалось. ${MIGRATION_HINT}`, { reply_markup: menuForRole(profile.role) })
      return true
    }
    await sendMessage(chatId, `↩️ ${LABELS[key].title}: возвращено значение по умолчанию.`, { reply_markup: menuForRole(profile.role) })
    await sendLinksScreen(chatId, companyId)
    return true
  }

  const parsed = parseLinkInput(key, text)
  if (!parsed.ok) {
    await sendMessage(chatId,
      `⚠️ ${parsed.reason}\nПришлите ссылку ещё раз — ${escapeMd(LABELS[key].hint)} («-» — по умолчанию).`,
      { reply_markup: cancelKeyboard }
    )
    return true
  }

  const res = await saveVenueLink(db(), companyId, key, parsed.url, telegramId)
  await clearState(telegramId)
  if (!res.ok) {
    console.error('venue_links save error:', res.error)
    await sendMessage(chatId, `❌ Не удалось сохранить. ${MIGRATION_HINT}`, { reply_markup: menuForRole(profile.role) })
    return true
  }

  const notGoogle = key === 'review' && !/(^|\.)(google\.[a-z.]+|goo\.gl|g\.page)$/i.test(new URL(parsed.url).hostname)
  await sendMessage(chatId,
    `✅ ${LABELS[key].title} сохранён — на экране уже новая ссылка.` +
    (notGoogle ? '\n⚠️ Это не похоже на ссылку Google — проверьте, что она ведёт на форму отзыва.' : ''),
    { reply_markup: menuForRole(profile.role) }
  )
  await sendLinksScreen(chatId, companyId)
  return true
}
