import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ссылка недействительна — BirTapCard',
}

export default function ScanErrorPage() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: 24,
    }}>
      <div style={{
        width: 74, height: 74, borderRadius: 22, marginBottom: 22,
        display: 'grid', placeItems: 'center',
        background: 'var(--danger-dim)',
        border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--danger)"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.3 3.7 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4M12 16.8v.4" />
        </svg>
      </div>

      <h1 style={{ fontSize: 21, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.01em' }}>
        Ссылка недействительна
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', maxWidth: 330, lineHeight: 1.7, margin: 0 }}>
        Эта NFC- или QR-метка не найдена в системе либо временно деактивирована.
        Обратитесь к администратору заведения.
      </p>

      <div style={{
        marginTop: 30, fontSize: 11, color: 'var(--text-muted)',
        letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 700,
      }}>
        BirTapCard
      </div>
    </div>
  )
}
