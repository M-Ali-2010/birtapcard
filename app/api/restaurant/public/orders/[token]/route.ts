import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  const { data, error } = await createServiceRoleClient()
    .from('restaurant_orders')
    .select('order_number, status, payment_status, total_uzs, created_at, restaurants(name, slug), dining_tables(table_number), restaurant_order_items(product_name, quantity, unit_price_uzs, modifiers, line_total_uzs)')
    .eq('tracking_token', token).maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
