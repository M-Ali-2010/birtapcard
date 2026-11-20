'use client'

import { useEffect } from 'react'
import { Icon } from '@/components/ui/icons'

export default function RestaurantError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Restaurant page error:', error)
  }, [error])

  return (
    <main className="rm-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80dvh' }}>
      <div style={{ textAlign: 'center', padding: '32px 20px', maxWidth: 420 }}>
        <div style={{
          width: 54, height: 54, borderRadius: '50%',
          background: 'rgba(239, 68, 68, .12)', color: '#ef4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Icon name="alert" size={26} />
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 8, color: 'var(--text)' }}>Не удалось загрузить меню</h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.5 }}>
          Возможно, пропал интернет или заведение обновляет меню.
        </p>
        <button
          onClick={() => reset()}
          style={{
            minHeight: 48, padding: '0 24px', borderRadius: 12,
            background: 'var(--mint)', color: '#0b1411', border: 'none',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Попробовать снова
        </button>
      </div>
    </main>
  )
}
