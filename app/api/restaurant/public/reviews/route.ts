import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: { token?: string; rating?: number; comment?: string; tags?: string[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
  if (!/^[0-9a-f-]{36}$/i.test(body.token ?? '') || !Number.isInteger(body.rating) || (body.rating ?? 0) < 1 || (body.rating ?? 0) > 5) {
    return NextResponse.json({ error: 'Поставьте оценку от 1 до 5' }, { status: 400 })
  }
  const db = createServiceRoleClient()
  const { data: order } = await db.from('restaurant_orders').select('id, restaurant_id, table_id, status').eq('tracking_token', body.token).maybeSingle()
  if (!order || !['delivered', 'completed'].includes(order.status)) {
    return NextResponse.json({ error: 'Оценку можно оставить после получения заказа' }, { status: 409 })
  }

  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) || null : null
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string').slice(0, 6) : []

  // Try inserting with tags first (if migration applied)
  let insertError = null
  if (tags.length > 0) {
    const { error: withTagsError } = await db.from('restaurant_reviews').insert({
      restaurant_id: order.restaurant_id,
      order_id: order.id,
      table_id: order.table_id,
      rating: body.rating,
      comment,
      tags,
    })
    insertError = withTagsError
  }

  // Fallback without tags if tags column doesn't exist yet on live DB or if tags is empty
  if (tags.length === 0 || (insertError && insertError.message?.includes('tags'))) {
    const { error: fallbackError } = await db.from('restaurant_reviews').insert({
      restaurant_id: order.restaurant_id,
      order_id: order.id,
      table_id: order.table_id,
      rating: body.rating,
      comment,
    })
    insertError = fallbackError
  }

  if (insertError?.code === '23505') return NextResponse.json({ error: 'Вы уже оценили этот заказ' }, { status: 409 })
  if (insertError) return NextResponse.json({ error: 'Не удалось сохранить отзыв' }, { status: 503 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
