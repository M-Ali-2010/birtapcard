import { notFound } from 'next/navigation'
import RestaurantAdminPanel from '@/components/restaurant/admin-panel'
import { getRestaurantMemberships } from '@/lib/restaurant/server'

const sections = ['orders', 'kitchen', 'menu', 'tables', 'feedback', 'team']
export default async function RestaurantAdminSection({ params }: { params: Promise<{ restaurantId: string; section: string }> }) {
  const { restaurantId, section } = await params
  if (!sections.includes(section)) notFound()
  const { restaurants } = await getRestaurantMemberships()
  const restaurant = restaurants.find((item) => item.id === restaurantId)
  if (!restaurant) notFound()
  return <RestaurantAdminPanel restaurantId={restaurantId} slug={restaurant.slug} section={section as 'orders'|'kitchen'|'menu'|'tables'|'feedback'|'team'} />
}
