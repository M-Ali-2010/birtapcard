import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicRestaurantMenu } from '@/lib/restaurant/public-menu'
import RestaurantMenu from '@/components/restaurant/public-menu'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; number: string }>
}): Promise<Metadata> {
  const { slug, number } = await params
  const menu = await getPublicRestaurantMenu(slug, number)
  if (!menu) return { title: 'Меню не найдено · BirTapCard' }
  return {
    title: `${menu.restaurant.name} · Стол ${menu.table.table_number} — Меню`,
    description: `Электронное меню и заказ со стола в ресторане ${menu.restaurant.name}`,
  }
}

export default async function RestaurantTablePage({
  params,
}: {
  params: Promise<{ slug: string; number: string }>
}) {
  const { slug, number } = await params
  const menu = await getPublicRestaurantMenu(slug, number)
  if (!menu) notFound()
  return <RestaurantMenu menu={menu} />
}
