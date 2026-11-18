import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantAccess } from '@/lib/restaurant/server'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId, ['restaurant_admin'])
  if (access instanceof NextResponse) return access
  const { data, error } = await access.service.from('restaurant_users').select('id, user_id, role, created_at').eq('restaurant_id', restaurantId).order('created_at')
  if (error) return NextResponse.json({ error: 'Не удалось загрузить команду' }, { status: 503 })
  const ids = (data ?? []).map((item) => item.user_id)
  const { data: profiles } = ids.length ? await access.service.from('profiles').select('user_id, full_name').in('user_id', ids) : { data: [] }
  const names = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.full_name]))
  return NextResponse.json((data ?? []).map((item) => ({ ...item, full_name: names.get(item.user_id) ?? null })))
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId, ['restaurant_admin'])
  if (access instanceof NextResponse) return access
  let body: { email?: string; role?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['restaurant_admin','staff','kitchen'].includes(body.role ?? '')) return NextResponse.json({ error: 'Укажите email аккаунта и роль' }, { status: 400 })
  let userId: string | null = null
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await access.service.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return NextResponse.json({ error: 'Не удалось проверить аккаунт' }, { status: 503 })
    const found = data.users.find((user) => user.email?.toLowerCase() === email)
    if (found) { userId = found.id; break }
    if (data.users.length < 1000) break
  }
  if (!userId) return NextResponse.json({ error: 'Аккаунт с таким email ещё не зарегистрирован в BirTapCard' }, { status: 404 })
  const { error } = await access.service.from('restaurant_users').upsert({ restaurant_id: restaurantId, user_id: userId, role: body.role }, { onConflict: 'restaurant_id,user_id' })
  if (error) return NextResponse.json({ error: 'Не удалось назначить роль' }, { status: 503 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const access = await requireRestaurantAccess(restaurantId, ['restaurant_admin'])
  if (access instanceof NextResponse) return access
  const userId = request.nextUrl.searchParams.get('user_id')
  if (!userId || userId === access.userId) return NextResponse.json({ error: 'Нельзя удалить себя из команды' }, { status: 400 })
  const { error } = await access.service.from('restaurant_users').delete().eq('restaurant_id', restaurantId).eq('user_id', userId)
  if (error) return NextResponse.json({ error: 'Не удалось удалить сотрудника' }, { status: 503 })
  return NextResponse.json({ ok: true })
}
