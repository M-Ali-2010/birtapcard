import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { pdpWifiFromEnv, renderPdpScreen, type PdpWifi } from '@/lib/screens/pdp-school'
import { getPdpSchoolWifi } from '@/lib/venue-wifi'
import { getPdpSchoolLinks } from '@/lib/venue-links'

// Экран ссылок PDP без токена: открывается по /pdp/links — для показа и проверки.
// Оформление по умолчанию — PDP EcoSystem; прежний вид School: /pdp/links?brand=school.
// Нажатия здесь не считаются (токена филиала нет). Язык выбирается на самой странице: ?lang=uz|ru|en.
// Адреса /pdp/* открыты без входа — см. isPublicInfoRoute в lib/supabase/middleware.ts.
//
// Wi-Fi читается при каждом запросе, поэтому маршрут динамический. Страница публичная, а пароль
// из базы (его вводит админ в боте) — не для всех: здесь показывается только название сети, чтобы
// видеть, как выглядит карточка. Сеть с паролем гость получает на реальном экране после скана.
// Исключение — переменные PDP_WIFI_*: их владелец задал осознанно, они показываются как есть.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const brand = new URL(request.url).searchParams.get('brand') === 'school' ? 'school' : 'ecosystem'
  let wifi: PdpWifi | null = pdpWifiFromEnv()
  if (!wifi) {
    try {
      const fromDb = await getPdpSchoolWifi(createServiceRoleClient())
      wifi = fromDb ? { ssid: fromDb.ssid } : null
    } catch {
      wifi = null // без базы демо должно открываться — просто без карточки Wi-Fi
    }
  }

  // Ссылки, заданные в боте, видны и в демо
  let links = {}
  try { links = await getPdpSchoolLinks(createServiceRoleClient()) } catch { links = {} }

  return new NextResponse(renderPdpScreen({ wifi, brand, links }), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=60',
    },
  })
}
