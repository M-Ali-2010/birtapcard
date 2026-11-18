'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icons'
import { ORDER_STATUS_LABELS, type RestaurantOrderStatus, formatUzs } from '@/lib/restaurant/types'

type OrderData = {
  order_number: number
  status: RestaurantOrderStatus
  payment_status: string
  total_uzs: number
  created_at: string
  restaurants: { name: string; slug: string } | null
  dining_tables: { table_number: string } | null
  restaurant_order_items: { product_name: string; quantity: number; line_total_uzs: number }[]
}

const stages: RestaurantOrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'delivered', 'completed']

export default function OrderTracking({ token }: { token: string }) {
  const [order, setOrder] = useState<OrderData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await fetch('/api/restaurant/public/orders/' + token, { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Заказ не найден')
        if (active) {
          setOrder(result)
          setError('')
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить заказ')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    const timer = window.setInterval(load, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [token, retry])

  async function sendReview() {
    if (!rating || reviewBusy) return
    setReviewBusy(true)
    setReviewError('')
    try {
      const response = await fetch('/api/restaurant/public/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, comment }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Не удалось отправить оценку')
      setReviewed(true)
    } catch (caught) {
      setReviewError(caught instanceof Error ? caught.message : 'Проверьте подключение и попробуйте ещё раз')
    } finally {
      setReviewBusy(false)
    }
  }

  if (loading && !order) {
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

  if (!order) {
    return (
      <main className="rt-page">
        <section className="rt-card rt-error-state">
          <span className="rt-state-icon"><Icon name="alert" size={22} /></span>
          <h1>Не удалось открыть заказ</h1>
          <p>{error || 'Проверьте ссылку и подключение к интернету.'}</p>
          <button className="rt-send" onClick={() => { setLoading(true); setRetry((value) => value + 1) }}>
            Попробовать снова
          </button>
        </section>
      </main>
    )
  }

  const stage = order.status === 'cancelled' ? -1 : stages.indexOf(order.status)
  const menuHref = order.restaurants && order.dining_tables
    ? '/restaurant/' + order.restaurants.slug + '/table/' + order.dining_tables.table_number
    : '/'

  return (
    <main className="rt-page">
      <section className="rt-card">
        <Link href={menuHref} className="rt-brand">
          <span className="rt-brand-mark"><Icon name="nfc" size={17} /></span>
          <span>BirTapCard</span>
          {order.restaurants?.name && <i>{order.restaurants.name}</i>}
        </Link>

        <div className="rt-order-heading">
          <div>
            <h1>Заказ №{order.order_number}</h1>
            <p>Стол {order.dining_tables?.table_number ?? '—'}</p>
          </div>
          <span className={'rt-status rt-status-' + order.status}>{ORDER_STATUS_LABELS[order.status]}</span>
        </div>

        {order.status === 'cancelled' ? (
          <div className="rt-cancel">
            <Icon name="alert" size={19} />
            <span>Заказ отменён. Обратитесь к сотруднику ресторана.</span>
          </div>
        ) : (
          <ol className="rt-steps" aria-label="Этапы заказа">
            {stages.map((status, index) => {
              const isComplete = index <= stage
              const isCurrent = index === stage
              return (
                <li key={status} className={isComplete ? 'is-done' : ''} aria-current={isCurrent ? 'step' : undefined}>
                  <span className="rt-step-marker">
                    {isComplete && <Icon name="check" size={12} />}
                  </span>
                  <span>{ORDER_STATUS_LABELS[status]}</span>
                </li>
              )
            })}
          </ol>
        )}

        <section className="rt-order-items" aria-label="Состав заказа">
          <h2>Состав заказа</h2>
          {order.restaurant_order_items.map((item, index) => (
            <div className="rt-item" key={index}>
              <span>{item.product_name}<small> × {item.quantity}</small></span>
              <strong>{formatUzs(item.line_total_uzs)}</strong>
            </div>
          ))}
        </section>

        <div className="rt-total">
          <span>Итого <small>· оплата на кассе</small></span>
          <strong>{formatUzs(order.total_uzs)}</strong>
        </div>
        <p className="rt-refresh"><span className="rt-live-dot" />Статус обновляется автоматически</p>

        {['delivered', 'completed'].includes(order.status) && (
          <div className="rt-review">
            <h2>Как вам заказ?</h2>
            {reviewed ? (
              <p className="rt-thanks"><Icon name="check" size={17} />Спасибо за отзыв.</p>
            ) : (
              <>
                <p>Оцените блюдо и обслуживание</p>
                <div className="rt-stars" role="group" aria-label="Оценка заказа">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={rating === value}
                      aria-label={value + ' из 5'}
                      className={rating >= value ? 'is-on' : ''}
                      onClick={() => setRating(value)}
                    >
                      <Icon name="star" size={25} />
                    </button>
                  ))}
                </div>
                <label className="sr-only" htmlFor="review-comment">Комментарий к отзыву</label>
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={2000}
                  placeholder="Комментарий (необязательно)"
                />
                {reviewError && <p className="rt-review-error" role="alert">{reviewError}</p>}
                <button className="rt-send" disabled={!rating || reviewBusy} onClick={sendReview}>
                  {reviewBusy ? 'Отправляем…' : 'Оставить отзыв'}
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
