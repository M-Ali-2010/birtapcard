'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icons'

export default function OrderTrackingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Order tracking error:', error)
  }, [error])

  return (
    <main className="rt-page">
      <section className="rt-card rt-error-state">
        <span className="rt-state-icon"><Icon name="alert" size={26} /></span>
        <h1>Не удалось открыть статус заказа</h1>
        <p>Проверьте подключение к интернету или вернитесь назад.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button className="rt-send" onClick={() => reset()}>
            Попробовать снова
          </button>
          <button
            className="rt-secondary-btn"
            style={{ minHeight: 48, padding: '0 16px' }}
            onClick={() => router.back()}
          >
            Назад
          </button>
        </div>
      </section>
    </main>
  )
}
