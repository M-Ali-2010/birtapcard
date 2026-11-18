import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantAccess } from '@/lib/restaurant/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId)
  if (access instanceof NextResponse) return access
  const { data, error } = await access.service.from('restaurant_reviews').select('id, rating, sentiment, comment, created_at, restaurant_orders(order_number), dining_tables(table_number)').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: 'Не удалось загрузить отзывы' }, { status: 503 })
  return NextResponse.json(data ?? [])
}
