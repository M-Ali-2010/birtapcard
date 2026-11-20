import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  const { data, error } = await createServiceRoleClient()
    .from('restaurant_orders')
    .select('id, order_number, status, payment_status, total_uzs, created_at, restaurants(name, slug), dining_tables(table_number), restaurant_order_items(product_name, quantity, unit_price_uzs, modifiers, line_total_uzs)')
    .eq('tracking_token', token).maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  let body: { action?: string; reason?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }

  if (body.action === 'cancel') {
    const supabase = createServiceRoleClient()
    const { data: order, error: findError } = await supabase
      .from('restaurant_orders')
      .select('id, status')
      .eq('tracking_token', token)
      .maybeSingle()

    if (findError || !order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
    if (order.status !== 'new') {
      return NextResponse.json({ error: 'Заказ уже принят кухней и не может быть отменён автоматически' }, { status: 409 })
    }

    const { error: updateError } = await supabase
      .from('restaurant_orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id)

    if (updateError) return NextResponse.json({ error: 'Не удалось отменить заказ' }, { status: 500 })
    return NextResponse.json({ success: true, status: 'cancelled' })
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
}
