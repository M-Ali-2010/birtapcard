import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { renderScanGate } from '@/lib/scan-gate'
import { isPdpSchoolCompany, pdpWifiFromEnv, renderPdpSchoolScreen } from '@/lib/screens/pdp-school'
import { isSubscriptionExpired, renderExpiredPage } from '@/lib/scan-lock'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /r/go/[token]
 *
 * Промежуточная страница между сканированием и Google Reviews.
 * Скан здесь НЕ записывается — он уже зафиксирован в /r/nfc или /r/qr.
 * Сюда можно возвращаться сколько угодно раз, статистика не изменится.
 *
 * Страница сразу уводит гостя в Google, а когда он возвращается —
 * показывает предложение подписаться на Instagram заведения.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Токен приходит из адреса — пускаем дальше только валидный UUID
  if (!UUID.test(token)) {
    return NextResponse.redirect(new URL('/scan-error', _request.url))
  }

  const supabase = createServiceRoleClient()
  const { data: branch } = await supabase
    .from('branches')
    .select('name, google_url, instagram_url, yandex_url, gis_url, telegram_url, bot_url, active, paid_until, companies(name, logo_url)')
    .or(`nfc_token.eq.${token},qr_token.eq.${token}`)
    .maybeSingle()

  const company = Array.isArray(branch?.companies) ? branch.companies[0] : branch?.companies
  // У PDP School свой экран; ссылку на Google при необходимости подставит он сам
  const isPdp = isPdpSchoolCompany(company?.name)

  if (!branch || !branch.active || (!branch.google_url && !isPdp)) {
    return NextResponse.redirect(new URL('/scan-error', _request.url))
  }

  if (isSubscriptionExpired(branch.paid_until)) {
    return new NextResponse(renderExpiredPage(branch.name ?? ''), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  // Отдельный экран под PDP School — вместо общего (lib/screens/pdp-school.ts)
  if (isPdp) {
    const html = renderPdpSchoolScreen({
      token,
      googleUrl: branch.google_url,
      botUrl: branch.bot_url,
      telegramUrl: branch.telegram_url,
      wifi: pdpWifiFromEnv(),
    })
    return new NextResponse(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  // Ни одной дополнительной ссылки — показывать нечего, сразу в Google
  if (!branch.instagram_url && !branch.yandex_url && !branch.gis_url && !branch.telegram_url && !branch.bot_url) {
    return NextResponse.redirect(branch.google_url)
  }

  const html = renderScanGate({
    token,
    branchName: branch.name ?? '',
    googleUrl: branch.google_url,
    instagramUrl: branch.instagram_url,
    yandexUrl: branch.yandex_url,
    gisUrl: branch.gis_url,
    telegramUrl: branch.telegram_url,
    botUrl: branch.bot_url,
    logoUrl: company?.logo_url ?? null,
  })

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
