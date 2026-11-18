import { redirect } from 'next/navigation'
import { getRestaurantMemberships } from '@/lib/restaurant/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import RestaurantPlatformPanel from '@/components/restaurant/platform-panel'

export default async function RestaurantPlatformOverview() {
  const { isSuperAdmin } = await getRestaurantMemberships()
  if (!isSuperAdmin) redirect('/restaurant-admin')
  const db = createServiceRoleClient()
  const { data: restaurants } = await db.from('restaurants').select('id, name, slug, active, is_published, created_at, restaurant_subscriptions(status, plan_name, ends_at)').order('created_at', { ascending: false })
  const rows = await Promise.all((restaurants ?? []).map(async (restaurant) => {
    const [{ count: orders }, { count: members }, { data: paid }] = await Promise.all([
      db.from('restaurant_orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant.id),
      db.from('restaurant_users').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant.id),
      db.from('restaurant_payments').select('amount_uzs').eq('restaurant_id', restaurant.id),
    ])
    const subscription = Array.isArray(restaurant.restaurant_subscriptions) ? restaurant.restaurant_subscriptions[0] : restaurant.restaurant_subscriptions
    return { ...restaurant, orders: orders ?? 0, members: members ?? 0, revenue: (paid ?? []).reduce((sum, payment) => sum + payment.amount_uzs, 0), subscription }
  }))
  return <RestaurantPlatformPanel restaurants={rows} />
}
