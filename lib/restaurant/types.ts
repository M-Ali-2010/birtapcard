export type RestaurantRole = 'restaurant_admin' | 'staff' | 'kitchen' | 'super_admin'

export type RestaurantOrderStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'completed'
  | 'cancelled'

export type PublicModifier = {
  id: string
  name: string
  price_delta_uzs: number
  sort_order: number
  available?: boolean
}

export type PublicModifierGroup = {
  id: string
  name: string
  required: boolean
  min_select: number
  max_select: number
  sort_order: number
  product_modifiers: PublicModifier[]
}

export type PublicProduct = {
  id: string
  category_id: string
  name: string
  slug: string
  description: string | null
  ingredients: string | null
  allergens: string[]
  portion: string | null
  image_url: string | null
  price_uzs: number
  preparation_minutes: number | null
  is_popular: boolean
  is_new: boolean
  available: boolean
  product_modifier_groups: PublicModifierGroup[]
}

export type PublicCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  menu_products: PublicProduct[]
}

export type PublicRestaurantMenu = {
  restaurant: {
    id: string
    name: string
    slug: string
    description: string | null
    logo_url: string | null
    cover_url: string | null
    address: string | null
    phone: string | null
    currency: 'UZS'
  }
  table: { id: string; table_number: string }
  categories: PublicCategory[]
}

export type RestaurantOrderItem = {
  id: string
  product_name: string
  quantity: number
  unit_price_uzs: number
  modifiers: { id: string; name: string; price_delta_uzs: number }[]
  note: string | null
  line_total_uzs: number
}

export type RestaurantOrderRow = {
  id: string
  restaurant_id: string
  order_number: number
  status: RestaurantOrderStatus
  payment_status: 'unpaid' | 'paid' | 'refunded'
  payment_method: 'cash' | 'card' | 'terminal' | 'other' | null
  customer_note: string | null
  total_uzs: number
  created_at: string
  dining_tables: { table_number: string } | null
  restaurant_order_items: RestaurantOrderItem[]
}

export const ORDER_STATUS_LABELS: Record<RestaurantOrderStatus, string> = {
  new: 'Новый заказ',
  accepted: 'Принят',
  preparing: 'Готовится',
  ready: 'Готов',
  delivered: 'Доставлен',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

export const ORDER_STATUS_NEXT: Partial<Record<RestaurantOrderStatus, RestaurantOrderStatus>> = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
  delivered: 'completed',
}

export function formatUzs(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} сум`
}
