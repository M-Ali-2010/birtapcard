import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getRestaurantMemberships } from '@/lib/restaurant/server'

const links = [['orders','Заказы'],['kitchen','Кухня'],['menu','Меню'],['tables','Столы и QR'],['feedback','Отзывы'],['team','Команда']] as const

export default async function RestaurantAdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params
  const { restaurants } = await getRestaurantMemberships()
  const restaurant = restaurants.find((item) => item.id === restaurantId)
  if (!restaurant) redirect('/restaurant-admin')
  return <div className="ra-shell"><header className="ra-header"><Link href="/restaurant-admin" className="ra-logo">BirTapCard <span>Ресторан</span></Link><div className="ra-head-venue">{restaurant.name}{restaurant.slug === 'bella-italia' && <small>ДЕМО</small>}</div>{restaurant.role === 'super_admin' && <Link className="ra-back" href="/restaurant-admin/platform">Вся сеть</Link>}<Link className="ra-back" href="/dashboard">Аналитика</Link></header><aside className="ra-nav" aria-label="Управление рестораном">{links.map(([href,label]) => <Link key={href} href={`/restaurant-admin/${restaurantId}/${href}`}>{label}</Link>)}</aside><main className="ra-content">{children}</main></div>
}
