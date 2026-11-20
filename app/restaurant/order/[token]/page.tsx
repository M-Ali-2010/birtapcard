import type { Metadata } from 'next'
import OrderTracking from '@/components/restaurant/order-tracking'

export const metadata: Metadata = {
  title: 'Статус заказа · BirTapCard Restaurant Service',
  description: 'Отслеживание этапов приготовления и доставки вашего ресторанного заказа.',
}

export default async function OrderTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <OrderTracking token={token} />
}
