import { redirect } from 'next/navigation'
import { getRestaurantMemberships } from '@/lib/restaurant/server'
import RestaurantAdminShell from '@/components/restaurant/admin-shell'

export default async function RestaurantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ restaurantId: string }>
}) {
  const { restaurantId } = await params
  const { restaurants } = await getRestaurantMemberships()
  const restaurant = restaurants.find((item) => item.id === restaurantId)

  if (!restaurant) redirect('/restaurant-admin')

  return (
    <RestaurantAdminShell
      restaurantId={restaurantId}
      restaurantName={restaurant.name}
      role={restaurant.role}
    >
      {children}
    </RestaurantAdminShell>
  )
}
