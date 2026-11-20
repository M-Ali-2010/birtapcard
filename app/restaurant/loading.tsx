export default function RestaurantLoading() {
  return (
    <main className="rm-page">
      <div className="rm-head" style={{ minHeight: 220, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span className="rm-spinner" aria-hidden="true" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <span style={{ fontSize: 14, color: 'var(--text-dim)', fontWeight: 600 }}>Загружаем меню…</span>
        </div>
      </div>
      <div className="rm-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
          <div style={{ height: 48, background: 'var(--surface)', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 120, background: 'var(--surface)', borderRadius: 16, animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 120, background: 'var(--surface)', borderRadius: 16, animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>
    </main>
  )
}
