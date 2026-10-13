import { NextResponse } from 'next/server'
import { pdpWifiFromEnv, renderPdpSchoolScreen } from '@/lib/screens/pdp-school'

// Экран ссылок PDP School без токена: открывается по /pdp/links — для показа и проверки.
// Нажатия здесь не считаются (токена филиала нет). Язык выбирается на самой странице: ?lang=uz|ru|en.
// Адреса /pdp/* открыты без входа — см. isPublicInfoRoute в lib/supabase/middleware.ts.
//
// Wi-Fi берётся из PDP_WIFI_SSID / PDP_WIFI_PASSWORD при каждом запросе, поэтому маршрут динамический.
// Страница публичная: если переменные заданы, название сети и пароль видит любой, кто её откроет.
export const dynamic = 'force-dynamic'

export function GET() {
  return new NextResponse(renderPdpSchoolScreen({ wifi: pdpWifiFromEnv() }), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=60',
    },
  })
}
