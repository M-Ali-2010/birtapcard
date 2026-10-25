/**
 * lib/telegram/handlers/paymentsAdmin.ts
 *
 * Управление входящими оплатами и чеками клиентов для super_admin.
 * Просмотр заявок со статусами, проверка чеков, подтверждение и отклонение.
 */

import { sendMessage, answerCallback, keyboard, escapeMd, type InlineButton } from '@/lib/telegram/bot'
import { db, findProfile } from '@/lib/telegram/db'
import { navRow } from '@/lib/telegram/keyboards/main'
import { handleAdminApprove, handleAdminReject } from '@/lib/telegram/handlers/admin'

const STATUS_LABELS: Record<string, string> = {
  pending_review: '⏳ Ожидает проверки',
  awaiting_receipt: '📝 Ожидает чек',
  approved: '✅ Подтверждена',
  rejected: '❌ Отклонена',
}

export async function handleAdminPayments(chatId: number, telegramId: number, filter = 'pending') {
  const profile = await findProfile(telegramId)
  if (!profile || profile.role !== 'super_admin') {
    await sendMessage(chatId, '⛔ Раздел доступен только администраторам.')
    return
  }

  const supabase = db()
  let query = supabase
    .from('payment_receipts')
    .select('id, company_id, amount, currency, months, status, receipt_url, created_at, companies(name)')
    .order('created_at', { ascending: false })
    .limit(10)

  if (filter === 'pending') {
    query = query.eq('status', 'pending_review')
  } else if (filter === 'approved') {
    query = query.eq('status', 'approved')
  } else if (filter === 'rejected') {
    query = query.eq('status', 'rejected')
  }

  const { data: receipts, error } = await query

  if (error || !receipts) {
    await sendMessage(chatId, '❌ Не удалось загрузить оплаты.')
    return
  }

  const { count: pendingCount } = await supabase
    .from('payment_receipts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_review')

  const filterRow: InlineButton[] = [
    { text: filter === 'pending' ? '• ⏳ Ждут проверки' : '⏳ Ждут проверки', callback_data: 'pay_adm:f:pending' },
    { text: filter === 'approved' ? '• ✅ Одобренные' : '✅ Одобренные', callback_data: 'pay_adm:f:approved' },
    { text: filter === 'all' ? '• Все' : 'Все', callback_data: 'pay_adm:f:all' },
  ]

  let headText = `💰 *Оплаты и чеки*\n\n` +
    `Новых чеков на проверку: *${pendingCount ?? 0}*\n\n`

  if (!receipts.length) {
    headText += `_В этом фильтре чеков нет._`
    await sendMessage(chatId, headText, { reply_markup: keyboard([filterRow, navRow()]) })
    return
  }

  await sendMessage(chatId, headText, { reply_markup: keyboard([filterRow]) })

  for (const r of receipts) {
    const compName = Array.isArray(r.companies)
      ? r.companies[0]?.name
      : (r.companies as { name?: string } | null)?.name || 'Заведение'

    const dateStr = new Date(r.created_at).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })

    const statusText = STATUS_LABELS[r.status] || r.status
    const amountStr = `${r.amount.toLocaleString('ru-RU')} ${r.currency || 'UZS'}`

    const msg = `🧾 *Заявка #${r.id.slice(0, 8)}*\n` +
      `🏢 Заведение: *${escapeMd(compName)}*\n` +
      `💰 Сумма: *${amountStr}* (${r.months} мес.)\n` +
      `📅 Дата: ${dateStr}\n` +
      `Статус: ${statusText}`

    const buttons: InlineButton[][] = []

    if (r.receipt_url) {
      buttons.push([{ text: '🖼 Открыть чек / квитанцию', url: r.receipt_url }])
    }

    if (r.status === 'pending_review') {
      buttons.push([
        { text: '✅ Подтвердить', callback_data: `approve_receipt:${r.id}` },
        { text: '❌ Отклонить', callback_data: `reject_receipt:${r.id}` },
      ])
    }

    await sendMessage(chatId, msg, buttons.length ? { reply_markup: keyboard(buttons) } : {})
  }
}
