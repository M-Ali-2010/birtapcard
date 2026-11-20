export default function OrderTrackingLoading() {
  return (
    <main className="rt-page">
      <section className="rt-card rt-loading" aria-label="Загрузка статуса заказа" aria-busy="true">
        <span className="rt-skeleton rt-skeleton-short" />
        <span className="rt-skeleton rt-skeleton-title" />
        <span className="rt-skeleton" />
        <span className="rt-skeleton rt-skeleton-wide" />
      </section>
    </main>
  )
}
