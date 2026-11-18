import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantAccess } from '@/lib/restaurant/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId)
  if (access instanceof NextResponse) return access
  const { data, error } = await access.service.from('dining_tables').select('id, table_number, active, note, created_at').eq('restaurant_id', restaurantId).order('table_number')
  if (error) return NextResponse.json({ error: 'Не удалось загрузить столы' }, { status: 503 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId, ['restaurant_admin'])
  if (access instanceof NextResponse) return access
  let body: { table_number?: string; note?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
  const number = body.table_number?.trim()
  if (!number || number.length > 12) return NextResponse.json({ error: 'Номер стола должен быть до 12 символов' }, { status: 400 })
  const { data, error } = await access.service.from('dining_tables').insert({ restaurant_id: restaurantId, table_number: number, note: body.note?.trim().slice(0, 120) || null }).select('id, table_number, active, note').single()
  if (error) return NextResponse.json({ error: 'Стол с таким номером уже существует' }, { status: 409 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId, ['restaurant_admin'])
  if (access instanceof NextResponse) return access
  let body: { id?: string; active?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
  if (!body.id || typeof body.active !== 'boolean') return NextResponse.json({ error: 'Некорректное изменение' }, { status: 400 })
  const { error } = await access.service.from('dining_tables').update({ active: body.active }).eq('restaurant_id', restaurantId).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Не удалось обновить стол' }, { status: 503 })
  return NextResponse.json({ ok: true })
}
