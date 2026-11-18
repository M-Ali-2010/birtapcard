import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/server'
import type { PublicCategory, PublicProduct, PublicRestaurantMenu } from '@/lib/restaurant/types'

export async function getPublicRestaurantMenu(slug: string, tableNumber: string): Promise<PublicRestaurantMenu | null> {
  const supabase = createServiceRoleClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, description, logo_url, cover_url, address, phone, currency')
    .eq('slug', slug)
    .eq('active', true)
    .eq('is_published', true)
    .maybeSingle()
  if (!restaurant) return null

  const { data: table } = await supabase
    .from('dining_tables')
    .select('id, table_number')
    .eq('restaurant_id', restaurant.id)
    .eq('table_number', tableNumber)
    .eq('active', true)
    .maybeSingle()
  if (!table) return null

  const { data: rawCategories } = await supabase
    .from('menu_categories')
    .select('id, name, slug, description, sort_order')
    .eq('restaurant_id', restaurant.id)
    .eq('active', true)
    .is('deleted_at', null)
    .order('sort_order')
  const categories = (rawCategories ?? []) as Omit<PublicCategory, 'menu_products'>[]
  const categoryIds = categories.map((category) => category.id)
  if (!categoryIds.length) return { restaurant: { ...restaurant, currency: 'UZS' }, table, categories: [] }

  const { data: rawProducts } = await supabase
    .from('menu_products')
    .select('id, category_id, name, slug, description, ingredients, allergens, portion, image_url, price_uzs, preparation_minutes, is_popular, is_new, available, product_modifier_groups(id, name, required, min_select, max_select, sort_order, product_modifiers(id, name, price_delta_uzs, sort_order, available))')
    .eq('restaurant_id', restaurant.id)
    .in('category_id', categoryIds)
    .eq('available', true)
    .is('deleted_at', null)
    .order('sort_order')
  const products = (rawProducts ?? []) as unknown as PublicProduct[]
  const categoriesWithProducts: PublicCategory[] = categories.map((category) => ({
    ...category,
    menu_products: products
      .filter((product) => product.category_id === category.id)
      .map((product) => ({
        ...product,
        product_modifier_groups: product.product_modifier_groups
          .filter((group) => group.product_modifiers.length > 0)
          .map((group) => ({
            ...group,
            product_modifiers: group.product_modifiers.filter((modifier) => modifier.available).sort((a, b) => a.sort_order - b.sort_order),
          }))
          .sort((a, b) => a.sort_order - b.sort_order),
      })),
  }))

  return {
    restaurant: { ...restaurant, currency: 'UZS' },
    table,
    categories: categoriesWithProducts,
  }
}
