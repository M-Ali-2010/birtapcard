import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

async function getSuperAdmin() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Требуется вход в аккаунт' }, { status: 401 }) }
  const { data: profile } = await userClient.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if (profile?.role !== 'super_admin') return { response: NextResponse.json({ error: 'Доступ только для суперадминистратора' }, { status: 403 }) }
  return { userId: user.id, service: createServiceRoleClient() }
}

export async function POST(request: NextRequest) {
  const auth = await getSuperAdmin()
  if (auth.response) return auth.response
  let body: { name?: string; slug?: string; address?: string; phone?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
  const name = body.name?.trim()
  const slug = body.slug?.trim().toLowerCase()
  if (!name || name.length > 120 || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: 'Укажите название и короткий адрес латиницей' }, { status: 400 })
  const { data: restaurant, error } = await auth.service.from('restaurants').insert({ name, slug, address: body.address?.trim().slice(0, 240) || null, phone: body.phone?.trim().slice(0, 40) || null, active: true, is_published: false }).select('id, name, slug').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Такой адрес ресторана уже занят' : 'Не удалось создать ресторан' }, { status: error.code === '23505' ? 409 : 503 })
  await auth.service.from('restaurant_subscriptions').insert({ restaurant_id: restaurant.id, status: 'trial', plan_name: 'restaurant', starts_at: new Date().toISOString() })
  const { error: tableError } = await auth.service.from('dining_tables').insert({ restaurant_id: restaurant.id, table_number: '1' })
  if (tableError) return NextResponse.json({ error: 'Ресторан создан, но стартовый стол добавить не удалось', restaurant }, { status: 201 })
  return NextResponse.json({ ...restaurant, is_published: false }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await getSuperAdmin()
  if (auth.response) return auth.response
  let body: { id?: string; is_published?: boolean; active?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
  if (!body.id || (typeof body.is_published !== 'boolean' && typeof body.active !== 'boolean')) return NextResponse.json({ error: 'Некорректное изменение' }, { status: 400 })
  if (body.is_published) {
    const [{ count: products }, { count: tables }] = await Promise.all([
      auth.service.from('menu_products').select('id', { count: 'exact', head: true }).eq('restaurant_id', body.id).eq('available', true).is('deleted_at', null),
      auth.service.from('dining_tables').select('id', { count: 'exact', head: true }).eq('restaurant_id', body.id).eq('active', true),
    ])
    if (!products || !tables) return NextResponse.json({ error: 'Перед публикацией добавьте доступное блюдо и активный стол' }, { status: 409 })
  }
  const update: Record<string, boolean> = {}
  if (typeof body.is_published === 'boolean') update.is_published = body.is_published
  if (typeof body.active === 'boolean') update.active = body.active
  const { error } = await auth.service.from('restaurants').update(update).eq('id', body.id)
  if (error) return NextResponse.json({ error: 'Не удалось изменить ресторан' }, { status: 503 })
  return NextResponse.json({ ok: true })
}
