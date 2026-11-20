import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: {
    slug?: string
    table?: string
    items?: unknown
    note?: string
    client_request_id?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug ?? '') || !/^[\p{L}\p{N}-]{1,12}$/u.test(body.table ?? '')) {
    return NextResponse.json({ error: 'Проверьте ресторан и номер стола' }, { status: 400 })
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
    return NextResponse.json({ error: 'В корзине должно быть от 1 до 30 позиций' }, { status: 400 })
  }

  const items = body.items.map((item) => {
    const value = item as { product_id?: unknown; quantity?: unknown; modifier_ids?: unknown; note?: unknown }
    return {
      product_id: typeof value.product_id === 'string' ? value.product_id : '',
      quantity: Number(value.quantity),
      modifier_ids: Array.isArray(value.modifier_ids) ? value.modifier_ids.filter((id): id is string => typeof id === 'string') : [],
      note: typeof value.note === 'string' ? value.note.slice(0, 240) : null,
    }
  })

  if (items.some((item) => !item.product_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50)) {
    return NextResponse.json({ error: 'Проверьте количество блюд' }, { status: 400 })
  }

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null
  const clientRequestId = typeof body.client_request_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.client_request_id)
    ? body.client_request_id
    : null

  const supabase = createServiceRoleClient()

  try {
    const rpcParams: Record<string, unknown> = {
      p_restaurant_slug: body.slug,
      p_table_number: body.table,
      p_items: items,
      p_customer_note: note,
    }

    if (clientRequestId) {
      rpcParams.p_client_request_id = clientRequestId
    }

    let { data, error } = await supabase.rpc('create_public_restaurant_order', rpcParams)

    // Fallback if live Supabase does not have the 5th parameter yet
    if (error && error.message?.includes('create_public_restaurant_order') && clientRequestId) {
      delete rpcParams.p_client_request_id
      const retry = await supabase.rpc('create_public_restaurant_order', rpcParams)
      data = retry.data
      error = retry.error
    }

    if (error) {
      if (error.message?.includes('Menu item is unavailable')) {
        return NextResponse.json({ error: 'Одно из блюд закончилось. Обновите страницу и проверьте заказ.' }, { status: 422 })
      }
      if (error.message?.includes('Table not found')) {
        return NextResponse.json({ error: 'Стол временно отключен или не существует.' }, { status: 404 })
      }
      if (error.message?.includes('Restaurant not found')) {
        return NextResponse.json({ error: 'Ресторан временно закрыт или не принимает заказы.' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Не удалось оформить заказ. Пожалуйста, попробуйте снова.' }, { status: 422 })
    }

    return NextResponse.json(data, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Сервис заказов временно недоступен. Проверьте подключение.' }, { status: 503 })
  }
}
