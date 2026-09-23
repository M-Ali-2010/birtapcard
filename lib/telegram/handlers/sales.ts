/**
 * lib/telegram/handlers/sales.ts
 *
 * Публичная воронка бота — то, что видит человек, который ещё НЕ клиент:
 * пришёл с карточки, из презентации или по ссылке @birtapcard.
 *
 * Раньше такой собеседник получал «привяжите аккаунт в кабинете» и уходил.
 * Теперь он проходит короткий путь «что это → тарифы → заявка», а заявка
 * падает в таблицу leads и мгновенно уходит всем super_admin в Telegram.
 *
 * Форма намеренно из трёх шагов (заведение → город → телефон): имя и
 * username берём из самого Telegram, каждый лишний вопрос — минус заявка.
 */

import { sendMessage, keyboard, escapeMd, type ReplyMarkup, type InlineButton } from '@/lib/telegram/bot'
import { db, setState, getState, clearState, builtinAdminIds } from '@/lib/telegram/db'
import type { TgMessage, TgUser } from '@/lib/telegram/types'

/** Состояние формы заявки в bot_state */
export const LEAD_STATE = 'lead_form'

const SITE = 'https://birtapcard.vercel.app/info'
const PHONE_HUMAN = '+998 95 731 30 41'
const PHONE_TEL = '+998957313041'
const TG_CONTACT = 'birtapcard'

type PlanId = 'start' | 'business' | 'pro'

const PLANS: Record<PlanId, { name: string; price: string; per: string; for: string; lines: string[] }> = {
  start: {
    name: '🟢 Старт',
    price: '600 000 сум / год',
    per: '≈ 50 000 сум в месяц — 1 650 сум в день',
    for: 'Одна точка. Начать собирать отзывы уже на этой неделе.',
    lines: [
      '1 карточка NFC + QR, установка на месте',
      '3 кнопки на выбор — например Google, Instagram, Telegram',
      'Экран с вашим логотипом на трёх языках',
      'Личный кабинет: касания и нажатия за последние 30 дней',
      'Замена карточки при поломке — 1 раз в год',
    ],
  },
  business: {
    name: '🔵 Бизнес',
    price: '900 000 сум / год',
    per: '≈ 75 000 сум в месяц — один средний чек',
    for: 'Заведение, которое управляет репутацией, а не надеется на неё.',
    lines: [
      'Всё из «Старт», плюс:',
      '2 карточки — касса + стол, ресепшн + бар',
      'Все кнопки без ограничений: Google, Яндекс, 2ГИС, Instagram, Telegram, бот, сайт, меню, Wi-Fi',
      'Полная аналитика в кабинете: любой период, по дням и часам, выгрузка в Excel',
      'Реальные отзывы и рейтинг Google — опубликованные, а не переходы',
      'Отчёт в Telegram каждое утро в 9:00',
      'Замена карточки при поломке — 2 раза в год',
    ],
  },
  pro: {
    name: '🟡 Pro',
    price: '1 200 000 сум / год',
    per: '≈ 100 000 сум в месяц — один вернувшийся гость окупает',
    for: 'Для заведений с несколькими филиалами и бизнеса, который хочет управлять клиентскими каналами на основе данных.',
    lines: [
      'Всё из «Бизнес», плюс:',
      'До 4 карточек на один филиал — бар, стол, ресепшн и любые точки',
      'Индивидуальный дизайн экрана в вашем фирменном стиле',
      'Уведомление о каждом новом отзыве Google и падении рейтинга',
      'Кнопка «Написать владельцу» — недовольный гость пишет вам, а не в Google',
      'До 5 сотрудников в кабинете',
      'Разбор статистики раз в квартал',
      'Замена карточек при поломке — 4 раза в год',
      '',
      '➕ Отдельно $50 единоразово — настройка Яндекс Бизнес под ключ',
    ],
  },
}

/** Нижнее меню для непривязанного собеседника */
export function salesMenu(): ReplyMarkup {
  return {
    keyboard: [
      [{ text: '🚀 Что это' }, { text: '💳 Тарифы' }],
      [{ text: '📝 Оставить заявку' }],
      [{ text: '🆘 Связаться с нами' }],
    ],
    resize_keyboard: true,
    persistent: true,
  }
}

function contactButtons(): InlineButton[][] {
  return [
    [{ text: '✈️ Написать в Telegram', url: `https://t.me/${TG_CONTACT}` }],
    [{ text: '🖥 Открыть презентацию', url: SITE }],
  ]
}

// ─── Экраны ──────────────────────────────────────────────────────────────────

export async function handleSalesStart(chatId: number, firstName?: string) {
  await sendMessage(chatId,
    `👋 ${firstName ? `*${escapeMd(firstName)}*, здравствуйте!` : 'Здравствуйте!'} Это *BirTapCard*.\n\n` +
    'Карточка на кассе: гость подносит телефон — и оставляет отзыв в Google, Яндекс или 2ГИС, ' +
    'подписывается на ваш Instagram или Telegram. Без приложений, за 15 секунд.\n\n' +
    'Вы видите каждое касание в личном кабинете.',
    { reply_markup: salesMenu() }
  )
  await sendMessage(chatId, 'С чего начнём?', {
    reply_markup: keyboard([
      [{ text: '🚀 Что это и как работает', callback_data: 'sales:what' }],
      [{ text: '💳 Тарифы и цены', callback_data: 'sales:plans' }],
      [{ text: '📝 Оставить заявку', callback_data: 'lead:start' }],
    ]),
  })
}

export async function handleSalesWhat(chatId: number) {
  await sendMessage(chatId,
    '🚀 *Как это работает*\n\n' +
    '1️⃣ Гость расплатился, кассир: «Если понравилось — оставьте отзыв»\n' +
    '2️⃣ Поднёс телефон к карточке или навёл камеру на QR\n' +
    '3️⃣ Открылся экран вашего заведения: Google · Яндекс · 2ГИС · Instagram · Telegram\n' +
    '4️⃣ Отзыв опубликован — касание уже видно в вашем кабинете\n\n' +
    '*Что получает владелец:*\n' +
    '• касания и переходы по каждой кнопке в реальном времени\n' +
    '• реальные отзывы и рейтинг Google, а не «клики»\n' +
    '• сравнение филиалов в одном кабинете\n' +
    '• отчёт в Telegram каждое утро\n\n' +
    '*Устройство:* NFC + QR в одной карточке, без питания и интернета, работает годами.',
    {
      reply_markup: keyboard([
        [{ text: '💳 Смотреть тарифы', callback_data: 'sales:plans' }],
        [{ text: '📝 Оставить заявку', callback_data: 'lead:start' }],
        ...contactButtons(),
      ]),
    }
  )
}

export async function handleSalesPlans(chatId: number) {
  await sendMessage(chatId,
    '💳 *Три тарифа. Один год. Без скрытых платежей.*\n\n' +
    'В каждом — карточка NFC + QR, установка на месте, экран с вашим логотипом на трёх языках и личный кабинет.\n\n' +
    `🟢 *Старт* — 600 000 сум / год\n_Одна точка, 3 кнопки, кабинет за 30 дней_\n\n` +
    `🔵 *Бизнес* — 900 000 сум / год\n_2 карточки, все кнопки, полная аналитика, отзывы Google, отчёт в Telegram_\n\n` +
    `🟡 *Pro* — 1 200 000 сум / год\n_До 4 карточек на филиал, свой дизайн экрана, уведомления об отзывах, 5 сотрудников_\n\n` +
    'Нажмите тариф — покажу, что именно входит.',
    {
      reply_markup: keyboard([
        [{ text: '🟢 Старт', callback_data: 'sales:plan:start' }],
        [{ text: '🔵 Бизнес', callback_data: 'sales:plan:business' }],
        [{ text: '🟡 Pro', callback_data: 'sales:plan:pro' }],
        [{ text: '📝 Оставить заявку', callback_data: 'lead:start' }],
      ]),
    }
  )
}

export async function handleSalesPlan(chatId: number, planId: string) {
  const plan = PLANS[planId as PlanId]
  if (!plan) {
    await handleSalesPlans(chatId)
    return
  }

  const body = plan.lines.map((l) => (l ? (l.endsWith(':') ? `\n*${l}*` : `✓ ${l}`) : '')).join('\n')

  await sendMessage(chatId,
    `${plan.name} — *${plan.price}*\n_${plan.per}_\n\n` +
    `${plan.for}\n\n` +
    `${body}\n\n` +
    '🔒 Цена фиксируется за вами. Тариф можно повысить в любой момент — доплачиваете только разницу.',
    {
      reply_markup: keyboard([
        [{ text: `📝 Хочу «${plan.name.replace(/^\S+\s/, '')}»`, callback_data: `lead:start:${planId}` }],
        [{ text: '⬅️ Все тарифы', callback_data: 'sales:plans' }],
        ...contactButtons(),
      ]),
    }
  )
}

export async function handleSalesContacts(chatId: number) {
  await sendMessage(chatId,
    '🆘 *Связаться с нами*\n\n' +
    `✈️ Telegram: @${TG_CONTACT}\n` +
    `📞 Телефон: ${PHONE_HUMAN}\n` +
    '✉️ Почта: birtapcard@gmail.com\n\n' +
    'Отвечаем быстро, обычно в течение часа.',
    {
      reply_markup: keyboard([
        [{ text: '✈️ Написать в Telegram', url: `https://t.me/${TG_CONTACT}` }],
        [{ text: '📞 Позвонить', url: `tel:${PHONE_TEL}` }],
        [{ text: '📝 Оставить заявку', callback_data: 'lead:start' }],
      ]),
    }
  )
}

// ─── Форма заявки ────────────────────────────────────────────────────────────

interface LeadDraft {
  step: 'venue' | 'city' | 'phone'
  plan?: string
  venue?: string
  city?: string
  source?: string
}

export async function isFillingLead(telegramId: number): Promise<boolean> {
  const state = await getState(telegramId)
  return state?.state === LEAD_STATE
}

export async function handleLeadStart(chatId: number, telegramId: number, plan?: string, source?: string) {
  await setState(telegramId, LEAD_STATE, { step: 'venue', plan, source } satisfies LeadDraft)
  await sendMessage(chatId,
    '📝 *Заявка на подключение*\n\n' +
    'Три коротких вопроса — и мы свяжемся с вами.\n\n' +
    '*1 из 3.* Как называется ваше заведение?',
    { reply_markup: { keyboard: [[{ text: '❌ Отменить' }]], resize_keyboard: true, one_time_keyboard: true } }
  )
}

/** Шаг формы: текст или присланный контакт. Возвращает true, если сообщение потрачено на форму. */
export async function handleLeadInput(chatId: number, telegramId: number, msg: TgMessage): Promise<boolean> {
  const state = await getState(telegramId)
  if (state?.state !== LEAD_STATE) return false

  const draft = (state.payload ?? {}) as unknown as LeadDraft
  const text = (msg.text ?? '').trim()

  if (text === '❌ Отменить' || text === '/cancel') {
    await clearState(telegramId)
    await sendMessage(chatId, 'Заявка отменена. Если передумаете — кнопка «📝 Оставить заявку» на месте.', {
      reply_markup: salesMenu(),
    })
    return true
  }

  // ─── 1. Заведение ──────────────────────────────────────────────────────────
  if (draft.step === 'venue') {
    if (!text) return true
    await setState(telegramId, LEAD_STATE, { ...draft, step: 'city', venue: text.slice(0, 120) })
    await sendMessage(chatId, '*2 из 3.* В каком городе? Если точек несколько — напишите сколько.', {
      reply_markup: { keyboard: [[{ text: 'Ташкент' }, { text: 'Самарканд' }], [{ text: '❌ Отменить' }]], resize_keyboard: true },
    })
    return true
  }

  // ─── 2. Город ──────────────────────────────────────────────────────────────
  if (draft.step === 'city') {
    if (!text) return true
    await setState(telegramId, LEAD_STATE, { ...draft, step: 'phone', city: text.slice(0, 120) })
    await sendMessage(chatId,
      '*3 из 3.* Оставьте номер телефона — нажмите кнопку ниже или напишите вручную.',
      {
        reply_markup: {
          keyboard: [[{ text: '📞 Отправить мой номер', request_contact: true }], [{ text: '❌ Отменить' }]],
          resize_keyboard: true,
        },
      }
    )
    return true
  }

  // ─── 3. Телефон → сохранение ───────────────────────────────────────────────
  if (draft.step === 'phone') {
    const phone = msg.contact?.phone_number ?? text
    if (!phone) return true
    await clearState(telegramId)
    await saveLead(chatId, telegramId, msg.from, draft, phone.slice(0, 40))
    return true
  }

  return true
}

async function saveLead(
  chatId: number,
  telegramId: number,
  from: TgUser | undefined,
  draft: LeadDraft,
  phone: string
) {
  const supabase = db()
  const contactName = [from?.first_name, from?.last_name].filter(Boolean).join(' ') || null

  const { data: lead } = await supabase
    .from('leads')
    .insert({
      source: draft.source ? `bot:${draft.source}` : 'bot',
      telegram_id: telegramId,
      tg_username: from?.username ?? null,
      contact_name: contactName,
      venue: draft.venue ?? null,
      city: draft.city ?? null,
      phone,
      plan: draft.plan ?? null,
    })
    .select('id')
    .single()

  const planName = draft.plan ? PLANS[draft.plan as PlanId]?.name ?? draft.plan : '—'

  await sendMessage(chatId,
    '✅ *Заявка принята!*\n\n' +
    `🏪 ${escapeMd(draft.venue ?? '—')}\n📍 ${escapeMd(draft.city ?? '—')}\n📞 ${escapeMd(phone)}\n💳 Тариф: ${planName}\n\n` +
    'Свяжемся с вами в ближайшее время. Если срочно — пишите напрямую: ' +
    `@${TG_CONTACT}`,
    { reply_markup: salesMenu() }
  )

  await notifyAdminsAboutLead({
    id: lead?.id ?? null,
    venue: draft.venue ?? '—',
    city: draft.city ?? '—',
    phone,
    planName,
    contactName,
    username: from?.username ?? null,
    telegramId,
    source: draft.source,
  })
}

// ─── Уведомление основателей ─────────────────────────────────────────────────

/** Telegram ID всех подтверждённых super_admin */
export async function superAdminChatIds(): Promise<number[]> {
  const supabase = db()
  const ids = new Set<number>(builtinAdminIds())

  const { data: admins } = await supabase.from('profiles').select('user_id').eq('role', 'super_admin')
  if (admins?.length) {
    const { data: accounts } = await supabase
      .from('telegram_accounts')
      .select('telegram_id')
      .in('user_id', admins.map((a) => a.user_id))
      .eq('active', true)
      .not('confirmed_at', 'is', null)

    for (const a of accounts ?? []) {
      const id = Number(a.telegram_id)
      if (id) ids.add(id)
    }
  }

  return [...ids]
}

async function notifyAdminsAboutLead(lead: {
  id: string | null
  venue: string
  city: string
  phone: string
  planName: string
  contactName: string | null
  username: string | null
  telegramId: number
  source?: string
}) {
  const chats = await superAdminChatIds()
  if (!chats.length) return

  const who = lead.username ? `@${lead.username}` : lead.contactName ?? `id${lead.telegramId}`
  const text =
    '🔥 *Новая заявка из бота*\n\n' +
    `🏪 *${escapeMd(lead.venue)}*\n` +
    `📍 ${escapeMd(lead.city)}\n` +
    `📞 \`${lead.phone.replace(/`/g, '')}\`\n` +
    `💳 ${lead.planName}\n` +
    `👤 ${escapeMd(who)}\n` +
    (lead.source ? `🔗 Источник: ${lead.source}\n` : '')

  const buttons: InlineButton[][] = [
    ...(lead.username ? [[{ text: '✈️ Написать клиенту', url: `https://t.me/${lead.username}` }]] : []),
    ...(lead.id
      ? [[
          { text: '🤝 Беру в работу', callback_data: `lead_set:in_progress:${lead.id}` },
          { text: '✅ Подключили', callback_data: `lead_set:won:${lead.id}` },
        ]]
      : []),
  ]

  for (const chatId of chats) {
    await sendMessage(chatId, text, buttons.length ? { reply_markup: keyboard(buttons) } : {})
  }
}
