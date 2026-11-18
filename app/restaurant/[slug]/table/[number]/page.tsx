import { notFound } from 'next/navigation'
import { getPublicRestaurantMenu } from '@/lib/restaurant/public-menu'
import RestaurantMenu from '@/components/restaurant/public-menu'

export default async function RestaurantTablePage({ params }: { params: Promise<{ slug: string; number: string }> }) {
  const { slug, number } = await params
  const menu = await getPublicRestaurantMenu(slug, number)
  if (!menu) notFound()
  return <RestaurantMenu menu={menu} />
}
