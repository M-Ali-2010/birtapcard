import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantAccess } from '@/lib/restaurant/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId, ['restaurant_admin'])
  if (access instanceof NextResponse) return access
  let body: { kind?: string; name?: string; category_id?: string; price_uzs?: number; description?: string; portion?: string; image_url?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
  const name = body.name?.trim()
  if (!name || name.length > 100) return NextResponse.json({ error: 'Название должно быть до 100 символов' }, { status: 400 })
  const slug = name.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || `item-${crypto.randomUUID().slice(0, 8)}`
  if (body.kind === 'category') {
    const { data, error } = await access.service.from('menu_categories').insert({ restaurant_id: restaurantId, name, slug }).select('id, name, slug, sort_order, active').single()
    if (error) return NextResponse.json({ error: 'Не удалось создать категорию' }, { status: 409 })
    return NextResponse.json(data, { status: 201 })
  }
  if (body.kind !== 'product' || !body.category_id || !Number.isInteger(body.price_uzs) || (body.price_uzs ?? -1) < 0) return NextResponse.json({ error: 'Выберите категорию и укажите цену в сумах' }, { status: 400 })
  const { data: category } = await access.service.from('menu_categories').select('id').eq('restaurant_id', restaurantId).eq('id', body.category_id).eq('active', true).is('deleted_at', null).maybeSingle()
  if (!category) return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
  const imageUrl = body.image_url?.trim()
  if (imageUrl && (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 1000)) return NextResponse.json({ error: 'Для фото используйте HTTPS-ссылку' }, { status: 400 })
  const { data, error } = await access.service.from('menu_products').insert({ restaurant_id: restaurantId, category_id: category.id, name, slug, price_uzs: body.price_uzs, description: body.description?.trim().slice(0, 600) || null, portion: body.portion?.trim().slice(0, 40) || null, image_url: imageUrl || null, available: true }).select('id, name, price_uzs, available, image_url, portion').single()
  if (error) return NextResponse.json({ error: 'Не удалось добавить блюдо: проверьте название и его уникальность' }, { status: 409 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId)
  if (access instanceof NextResponse) return access
  const { data, error } = await access.service.from('menu_categories').select('id, name, slug, sort_order, active, menu_products(id, name, price_uzs, available, image_url, portion, is_popular, is_new)').eq('restaurant_id', restaurantId).is('deleted_at', null).order('sort_order')
  if (error) return NextResponse.json({ error: 'Не удалось загрузить меню' }, { status: 503 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId, ['restaurant_admin'])
  if (access instanceof NextResponse) return access
  let body: { id?: string; available?: boolean; price_uzs?: number; name?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
  if (!body.id || (typeof body.available !== 'boolean' && (!Number.isInteger(body.price_uzs) || (body.price_uzs ?? -1) < 0) && typeof body.name !== 'string')) return NextResponse.json({ error: 'Некорректное изменение' }, { status: 400 })
  const update: Record<string, string | number | boolean> = {}
  if (typeof body.available === 'boolean') update.available = body.available
  if (Number.isInteger(body.price_uzs) && (body.price_uzs ?? -1) >= 0) update.price_uzs = body.price_uzs!
  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim().slice(0, 100)
  const { error } = await access.service.from('menu_products').update(update).eq('restaurant_id', restaurantId).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Не удалось изменить блюдо' }, { status: 503 })
  return NextResponse.json({ ok: true })
}
