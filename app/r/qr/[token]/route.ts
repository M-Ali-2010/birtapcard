import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getVisitorDevice, getClientIp, getBrowserLang, isBot } from '@/lib/visitor-hash'

export const dynamic = 'force-dynamic'

/**
 * GET /r/qr/[token]
 *
 * Цепочка:
 *  Пользователь сканирует QR-код → попадает сюда →
 *  сервер фильтрует ботов → фиксирует событие через record_scan() →
 *  редирект на Google Reviews.
 *
 * ЗАЩИТА ОТ ДУБЛЕЙ:
 *  1. Боты (Telegram Preview, WhatsApp, Slack и т.д.) отклоняются сразу.
 *  2. record_scan() в Postgres использует атомарный UPSERT в unique_visitors
 *     по (branch_id, visitor_hash, scan_date).
 *  3. Route вызывается ровно один раз на HTTP-запрос.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const userAgent = request.headers.get('user-agent') || ''

  // ── 1. Отклонить ботов и превью-краулеров ─────────────────────────────────
  if (isBot(userAgent)) {
    return new NextResponse(null, { status: 204 })
  }

  // ── 2. Собрать параметры реального посетителя ─────────────────────────────
  const supabase = createServiceRoleClient()
  const ip     = getClientIp(request)
  const device = getVisitorDevice(userAgent)
  const lang   = getBrowserLang(request)

  // ── 3. Атомарно зафиксировать событие в БД ───────────────────────────────
  const { data, error } = await supabase.rpc('record_scan', {
    p_token:     token,
    p_scan_type: 'qr',
    p_ip:        ip,
    p_user_agent: userAgent,
    p_device:    device,
    p_lang:      lang,
  })

  if (error) {
    console.error('record_scan error (qr):', error)
    return NextResponse.redirect(new URL('/scan-error', request.url))
  }

  if (!data || data.error) {
    return NextResponse.redirect(new URL('/scan-error', request.url))
  }

  // ── 4. Есть ли у филиала Instagram? ──────────────────────────────────────
  //    Если есть — уводим гостя через промежуточную страницу /r/go: она
  //    отправит его в Google, а по возвращении предложит подписаться.
  //    Скан уже записан выше, повторно /r/go его не фиксирует.
  const { data: branch } = await supabase
    .from('branches')
    .select('instagram_url, yandex_url, gis_url, telegram_url')
    .or(`nfc_token.eq.${token},qr_token.eq.${token}`)
    .maybeSingle()

  if (branch?.instagram_url || branch?.yandex_url || branch?.gis_url || branch?.telegram_url) {
    return NextResponse.redirect(new URL(`/r/go/${token}`, request.url))
  }

  // ── 5. Обычный путь: сразу на Google Reviews ─────────────────────────────
  return NextResponse.redirect(data.redirect_url)
}