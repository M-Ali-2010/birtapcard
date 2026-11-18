import 'server-only'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type { RestaurantRole } from '@/lib/restaurant/types'

export type RestaurantAccess = {
  userId: string
  role: RestaurantRole
  service: ReturnType<typeof createServiceRoleClient>
}

export function hasRestaurantDatabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function requireRestaurantAccess(
  restaurantId: string,
  roles?: RestaurantRole[],
): Promise<RestaurantAccess | NextResponse> {
  if (!hasRestaurantDatabaseConfig()) {
    return NextResponse.json({ error: 'Ресторанная база не настроена. Примените миграцию и задайте ключи Supabase.' }, { status: 503 })
  }

  const userClient = await createClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Требуется вход в аккаунт' }, { status: 401 })

  const { data: profile } = await userClient.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if (profile?.role === 'super_admin') {
    return { userId: user.id, role: 'super_admin', service: createServiceRoleClient() }
  }

  const { data: member } = await userClient
    .from('restaurant_users')
    .select('role')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || (roles && !roles.includes(member.role as RestaurantRole))) {
    return NextResponse.json({ error: 'Недостаточно прав для этого ресторана' }, { status: 403 })
  }

  return { userId: user.id, role: member.role as RestaurantRole, service: createServiceRoleClient() }
}

export async function getRestaurantMemberships() {
  if (!hasRestaurantDatabaseConfig()) return { userId: null, isSuperAdmin: false, restaurants: [] as { id: string; name: string; slug: string; role: RestaurantRole }[] }
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { userId: null, isSuperAdmin: false, restaurants: [] as { id: string; name: string; slug: string; role: RestaurantRole }[] }
  const { data: profile } = await userClient.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if (profile?.role === 'super_admin') {
    const { data } = await createServiceRoleClient().from('restaurants').select('id, name, slug').eq('active', true).order('name')
    return {
      userId: user.id,
      isSuperAdmin: true,
      restaurants: (data ?? []).map((r) => ({ ...r, role: 'super_admin' as const })),
    }
  }
  const { data } = await userClient
    .from('restaurant_users')
    .select('role, restaurants(id, name, slug, active)')
    .eq('user_id', user.id)
  const restaurants = (data ?? []).flatMap((entry) => {
    const restaurant = Array.isArray(entry.restaurants) ? entry.restaurants[0] : entry.restaurants
    if (!restaurant?.active) return []
    return [{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug, role: entry.role as RestaurantRole }]
  })
  return { userId: user.id, isSuperAdmin: false, restaurants }
}
