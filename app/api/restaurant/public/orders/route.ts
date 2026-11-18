import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: { slug?: string; table?: string; items?: unknown; note?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug ?? '') || !/^[\p{L}\p{N}-]{1,12}$/u.test(body.table ?? '')) {
    return NextResponse.json({ error: 'Проверьте ресторан и номер стола' }, { status: 400 })
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) return NextResponse.json({ error: 'В корзине должно быть от 1 до 30 позиций' }, { status: 400 })
  const items = body.items.map((item) => {
    const value = item as { product_id?: unknown; quantity?: unknown; modifier_ids?: unknown; note?: unknown }
    return {
      product_id: typeof value.product_id === 'string' ? value.product_id : '',
      quantity: Number(value.quantity),
      modifier_ids: Array.isArray(value.modifier_ids) ? value.modifier_ids.filter((id): id is string => typeof id === 'string') : [],
      note: typeof value.note === 'string' ? value.note.slice(0, 240) : null,
    }
  })
  if (items.some((item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50)) return NextResponse.json({ error: 'Проверьте количество блюд' }, { status: 400 })
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null
  try {
    const { data, error } = await createServiceRoleClient().rpc('create_public_restaurant_order', {
      p_restaurant_slug: body.slug,
      p_table_number: body.table,
      p_items: items,
      p_customer_note: note,
    })
    if (error) return NextResponse.json({ error: 'Не удалось оформить заказ. Обновите меню и попробуйте снова.' }, { status: 422 })
    return NextResponse.json(data, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Заказ временно недоступен' }, { status: 503 })
  }
}
