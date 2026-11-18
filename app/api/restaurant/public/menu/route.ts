import { NextRequest, NextResponse } from 'next/server'
import { getPublicRestaurantMenu } from '@/lib/restaurant/public-menu'

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')?.trim()
  const table = request.nextUrl.searchParams.get('table')?.trim()
  if (!slug || !table) return NextResponse.json({ error: 'Укажите ресторан и стол' }, { status: 400 })
  try {
    const menu = await getPublicRestaurantMenu(slug, table)
    if (!menu) return NextResponse.json({ error: 'Ресторан или стол не найден' }, { status: 404 })
    return NextResponse.json(menu, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
  } catch {
    return NextResponse.json({ error: 'Меню временно недоступно' }, { status: 503 })
  }
}
