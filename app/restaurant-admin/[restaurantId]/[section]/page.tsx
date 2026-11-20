import { notFound, redirect } from 'next/navigation'
import RestaurantAdminPanel from '@/components/restaurant/admin-panel'
import { getRestaurantMemberships } from '@/lib/restaurant/server'
import type { RestaurantRole } from '@/lib/restaurant/types'

const sections = ['orders', 'kitchen', 'menu', 'tables', 'feedback', 'team'] as const
type Section = (typeof sections)[number]

const roleAllowedSections: Record<RestaurantRole, Section[]> = {
  kitchen: ['kitchen', 'orders'],
  staff: ['orders', 'kitchen', 'tables', 'feedback'],
  restaurant_admin: ['orders', 'kitchen', 'menu', 'tables', 'feedback', 'team'],
  super_admin: ['orders', 'kitchen', 'menu', 'tables', 'feedback', 'team'],
}

export default async function RestaurantAdminSection({
  params,
}: {
  params: Promise<{ restaurantId: string; section: string }>
}) {
  const { restaurantId, section } = await params
  if (!sections.includes(section as Section)) notFound()

  const { restaurants } = await getRestaurantMemberships()
  const restaurant = restaurants.find((item) => item.id === restaurantId)
  if (!restaurant) notFound()

  const allowed = roleAllowedSections[restaurant.role] || ['orders']
  if (!allowed.includes(section as Section)) {
    redirect(`/restaurant-admin/${restaurantId}/${allowed[0]}`)
  }

  return (
    <RestaurantAdminPanel
      restaurantId={restaurantId}
      slug={restaurant.slug}
      section={section as Section}
      role={restaurant.role}
    />
  )
}
