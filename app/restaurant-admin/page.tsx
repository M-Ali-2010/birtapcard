import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getRestaurantMemberships } from '@/lib/restaurant/server'

export default async function RestaurantAdminHome() {
  const { restaurants } = await getRestaurantMemberships()
  if (!restaurants.length) redirect('/dashboard')
  if (restaurants.length === 1) redirect(`/restaurant-admin/${restaurants[0].id}/orders`)
  return <main className="ra-picker"><h1>Ресторанная система</h1><p>Выберите заведение для управления.</p>{restaurants.map((restaurant) => <Link key={restaurant.id} href={`/restaurant-admin/${restaurant.id}/orders`} className="ra-picker-link"><strong>{restaurant.name}</strong><span>{restaurant.role === 'super_admin' ? 'Суперадминистратор' : restaurant.role}</span></Link>)}</main>
}
