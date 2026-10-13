import { NextResponse } from 'next/server'
import { renderPdpSchoolScreen } from '@/lib/screens/pdp-school'

// Экран ссылок PDP School без токена: открывается по /pdp/links — для показа и проверки.
// Нажатия здесь не считаются (токена филиала нет). Язык выбирается на самой странице: ?lang=uz|ru|en.
// Адреса /pdp/* открыты без входа — см. isPublicInfoRoute в lib/supabase/middleware.ts.
export const dynamic = 'force-static'

export function GET() {
  return new NextResponse(renderPdpSchoolScreen(), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  })
}
