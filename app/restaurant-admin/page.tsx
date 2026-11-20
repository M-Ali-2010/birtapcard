import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getRestaurantMemberships } from '@/lib/restaurant/server'

export default async function RestaurantAdminHome() {
  const { restaurants } = await getRestaurantMemberships()
  if (!restaurants.length) redirect('/dashboard')

  if (restaurants.length === 1) {
    const single = restaurants[0]
    const defaultSection = single.role === 'kitchen' ? 'kitchen' : 'orders'
    redirect(`/restaurant-admin/${single.id}/${defaultSection}`)
  }

  return (
    <main className="ra-picker">
      <h1>Ресторанная система</h1>
      <p>Выберите заведение для управления.</p>
      {restaurants.map((restaurant) => {
        const defaultSection = restaurant.role === 'kitchen' ? 'kitchen' : 'orders'
        return (
          <Link
            key={restaurant.id}
            href={`/restaurant-admin/${restaurant.id}/${defaultSection}`}
            className="ra-picker-link"
          >
            <strong>{restaurant.name}</strong>
            <span>
              {restaurant.role === 'super_admin'
                ? 'Суперадминистратор'
                : restaurant.role === 'kitchen'
                ? 'Кухня'
                : restaurant.role === 'staff'
                ? 'Сотрудник зала'
                : 'Администратор'}
            </span>
          </Link>
        )
      })}
    </main>
  )
}
