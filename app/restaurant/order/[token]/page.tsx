import OrderTracking from '@/components/restaurant/order-tracking'

export default async function OrderTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <OrderTracking token={token} />
}
