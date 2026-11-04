import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { renderScanGate, isShoesMaster } from '@/lib/scan-gate'
import { isPdpSchoolCompany, pdpWifiFromEnv, renderPdpScreen } from '@/lib/screens/pdp-school'
import { isSubscriptionExpired, renderExpiredPage } from '@/lib/scan-lock'
import { getVenueWifi } from '@/lib/venue-wifi'
import { getVenueLinks } from '@/lib/venue-links'

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

  const isShoesByToken = isShoesMaster(null, null, token)

  // Токен приходит из адреса — пускаем валидный UUID или предопределённые алиасы
  if (!UUID.test(token) && !isShoesByToken) {
    return NextResponse.redirect(new URL('/scan-error', _request.url))
  }

  const supabase = createServiceRoleClient()
  let branchQuery = supabase
    .from('branches')
    .select('company_id, name, slug, google_url, instagram_url, yandex_url, gis_url, telegram_url, bot_url, active, paid_until, companies(name, slug, logo_url)')

  if (UUID.test(token)) {
    branchQuery = branchQuery.or(`nfc_token.eq.${token},qr_token.eq.${token}`)
  } else {
    branchQuery = branchQuery.eq('slug', token)
  }

  let { data: branch } = await branchQuery.maybeSingle()
  let company = Array.isArray(branch?.companies) ? branch.companies[0] : branch?.companies

  const isShoes =
    isShoesByToken ||
    isShoesMaster(branch?.name, (branch as unknown as { slug?: string })?.slug, token) ||
    isShoesMaster(company?.name, (company as unknown as { slug?: string })?.slug, token)

  // Fallback для заведения Shoes Master N1
  if (isShoes && !branch) {
    branch = {
      company_id: 'shoes-master',
      name: 'Shoes Master N1',
      slug: 'shoes-master-n1',
      google_url: 'https://maps.google.com/?q=Shoes+Master+N1',
      instagram_url: 'https://instagram.com/SHOES_MASTER_N1',
      telegram_url: 'https://t.me/poyabzaltamirlash',
      yandex_url: null,
      gis_url: null,
      bot_url: null,
      active: true,
      paid_until: null,
      companies: { name: 'Shoes Master N1', slug: 'shoes-master-n1', logo_url: null },
    } as unknown as typeof branch
    company = { name: 'Shoes Master N1', slug: 'shoes-master-n1', logo_url: null }
  }

  // У PDP School свой экран; ссылку на Google при необходимости подставит он сам
  const isPdp = isPdpSchoolCompany(company?.name)

  if (!branch || !branch.active || (!branch.google_url && !isPdp && !isShoes)) {
    return NextResponse.redirect(new URL('/scan-error', _request.url))
  }

  if (isSubscriptionExpired(branch.paid_until)) {
    return new NextResponse(renderExpiredPage(branch.name ?? ''), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  // Отдельный экран под PDP School — вместо общего (lib/screens/pdp-school.ts).
  // Wi-Fi: сначала то, что админ ввёл в боте (venue_wifi), запасной вариант — переменные PDP_WIFI_*
  if (isPdp) {
    const wifi = (await getVenueWifi(supabase, branch.company_id)) ?? pdpWifiFromEnv()
    const links = await getVenueLinks(supabase, branch.company_id)
    const html = renderPdpScreen({
      token,
      googleUrl: branch.google_url,
      botUrl: branch.bot_url,
      telegramUrl: branch.telegram_url,
      wifi,
      links,
    })
    return new NextResponse(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  // Ни одной дополнительной ссылки и нет своего фона — показывать нечего, сразу в Google
  if (!isShoes && !branch.instagram_url && !branch.yandex_url && !branch.gis_url && !branch.telegram_url && !branch.bot_url) {
    return NextResponse.redirect(branch.google_url)
  }

  const bgUrl = isShoes
    ? '/shoes-master-bg.jpg'
    : ((branch as unknown as { bg_url?: string })?.bg_url || (company as unknown as { cover_url?: string })?.cover_url || _request.nextUrl.searchParams.get('bg') || null)

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
    bgUrl,
  })

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
