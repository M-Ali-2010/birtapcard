import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantAccess } from '@/lib/restaurant/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId)
  if (access instanceof NextResponse) return access
  const status = request.nextUrl.searchParams.get('status')
  let query = access.service.from('restaurant_orders').select('id, restaurant_id, order_number, status, payment_status, payment_method, customer_note, total_uzs, created_at, dining_tables(table_number), restaurant_order_items(id, product_name, quantity, unit_price_uzs, modifiers, note, line_total_uzs)').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(100)
  if (status && status !== 'all') query = query.eq('status', status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Не удалось загрузить заказы' }, { status: 503 })
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId, ['restaurant_admin', 'staff', 'kitchen'])
  if (access instanceof NextResponse) return access
  let body: { orderId?: string; status?: string; payment_method?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
  if (!body.orderId || (!body.status && !body.payment_method)) return NextResponse.json({ error: 'Укажите изменение заказа' }, { status: 400 })
  const { error } = await access.service.rpc('transition_restaurant_order', { p_restaurant_id: restaurantId, p_order_id: body.orderId, p_status: body.status ?? null, p_payment_method: body.payment_method ?? null, p_actor_user_id: access.userId })
  if (error) return NextResponse.json({ error: 'Статус нельзя изменить или заказ уже оплачен' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
