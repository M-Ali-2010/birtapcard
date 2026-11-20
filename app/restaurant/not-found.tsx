import Link from 'next/link'
import { Icon } from '@/components/ui/icons'

export default function RestaurantNotFound() {
  return (
    <main className="rm-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80dvh' }}>
      <div style={{ textAlign: 'center', padding: '32px 20px', maxWidth: 420 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--surface)', color: 'var(--text-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', border: '1px solid var(--border)',
        }}>
          <Icon name="restaurants" size={26} />
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 8, color: 'var(--text)' }}>Меню или стол не найдены</h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.5 }}>
          Проверьте QR-код на столе или обратитесь к сотруднику заведения.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 48, padding: '0 24px', borderRadius: 12,
            background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}
        >
          На главную BirTapCard
        </Link>
      </div>
    </main>
  )
}
