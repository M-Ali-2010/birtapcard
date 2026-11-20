'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icons'
import {
  ORDER_STATUS_LABELS,
  type RestaurantOrderStatus,
  formatUzs,
} from '@/lib/restaurant/types'
import { updateGuestOrderStatus } from '@/lib/restaurant/guest-session'

type OrderData = {
  id?: string
  order_number: number
  status: RestaurantOrderStatus
  payment_status: string
  total_uzs: number
  created_at: string
  has_review?: boolean
  review_rating?: number | null
  restaurants: { name: string; slug: string } | null
  dining_tables: { table_number: string } | null
  restaurant_order_items: { product_name: string; quantity: number; line_total_uzs: number }[]
}

const GUEST_STAGES: { id: RestaurantOrderStatus; label: string }[] = [
  { id: 'accepted', label: 'Принят' },
  { id: 'preparing', label: 'Готовится' },
  { id: 'ready', label: 'Готов' },
  { id: 'delivered', label: 'Подан' },
]

const REVIEW_TAGS = [
  'Вкусно',
  'Быстро',
  'Горячее',
  'Красиво',
  'Сервис',
]

export default function OrderTracking({ token }: { token: string }) {
  const router = useRouter()
  const [order, setOrder] = useState<OrderData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)

  const [rating, setRating] = useState(0)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewError, setReviewError] = useState('')

  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [cancelError, setCancelError] = useState('')

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
          if (result.has_review) setReviewed(true)
          if (result.restaurants?.slug && result.dining_tables?.table_number) {
            updateGuestOrderStatus(
              result.restaurants.slug,
              result.dining_tables.table_number,
              token,
              result.status,
            )
          }
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить заказ')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    const timer = window.setInterval(load, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [token, retry])

  function toggleTag(tag: string) {
    const removing = selectedTags.includes(tag)
    setSelectedTags(prev => removing ? prev.filter(t => t !== tag) : [...prev, tag])
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(removing ? 5 : 10) } catch {}
    }
  }

  async function sendReview() {
    if (!rating || reviewBusy) return
    setReviewBusy(true)
    setReviewError('')
    try {
      const response = await fetch('/api/restaurant/public/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, comment, tags: selectedTags }),
      })
      const result = await response.json()
      if (!response.ok) {
        if (response.status === 409) { setReviewed(true); return }
        throw new Error(result.error ?? 'Не удалось отправить')
      }
      setReviewed(true)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(20) } catch {}
      }
    } catch (caught) {
      setReviewError(caught instanceof Error ? caught.message : 'Ошибка')
    } finally {
      setReviewBusy(false)
    }
  }

  async function cancelOrder() {
    if (cancelBusy) return
    setCancelBusy(true)
    setCancelError('')
    try {
      const response = await fetch('/api/restaurant/public/orders/' + token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Не удалось отменить')
      setCancelConfirmOpen(false)
      setOrder(prev => prev ? { ...prev, status: 'cancelled' } : null)
      if (order?.restaurants?.slug && order?.dining_tables?.table_number) {
        updateGuestOrderStatus(order.restaurants.slug, order.dining_tables.table_number, token, 'cancelled')
      }
    } catch (caught) {
      setCancelError(caught instanceof Error ? caught.message : 'Ошибка')
    } finally {
      setCancelBusy(false)
    }
  }

  if (loading && !order) {
    return (
      <main className="ot-page">
        <div className="ot-container">
          <div className="ot-loading">
            <div className="ot-spinner" />
            <span>Загрузка заказа...</span>
          </div>
        </div>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="ot-page">
        <div className="ot-container">
          <div className="ot-error">
            <Icon name="alert" size={32} />
            <h1>Заказ не найден</h1>
            <p>{error || 'Проверьте ссылку'}</p>
            <button onClick={() => { setLoading(true); setRetry(v => v + 1) }}>
              Повторить
            </button>
          </div>
        </div>
      </main>
    )
  }

  const menuHref = order.restaurants && order.dining_tables
    ? `/restaurant/${order.restaurants.slug}/table/${order.dining_tables.table_number}`
    : '/'

  let activeStageIndex = 0
  if (order.status === 'new' || order.status === 'accepted') activeStageIndex = 0
  else if (order.status === 'preparing') activeStageIndex = 1
  else if (order.status === 'ready') activeStageIndex = 2
  else if (order.status === 'delivered' || order.status === 'completed') activeStageIndex = 3

  const isCancelled = order.status === 'cancelled'
  const isCompleted = ['delivered', 'completed'].includes(order.status)

  return (
    <main className="ot-page">
      <div className="ot-container">
        {/* Компактный header */}
        <header className="ot-header">
          <Link href={menuHref} className="ot-back">
            <Icon name="arrowLeft" size={20} />
          </Link>
          <div className="ot-header-info">
            <strong>{order.restaurants?.name ?? 'Ресторан'}</strong>
            <span>Стол {order.dining_tables?.table_number}</span>
          </div>
          <div className="ot-live">
            <span className="ot-live-dot" />
          </div>
        </header>

        {/* Основная карточка */}
        <div className="ot-card">
          {/* Заголовок заказа */}
          <div className="ot-order-header">
            <div>
              <h1>Заказ №{order.order_number}</h1>
              <span className="ot-time">
                {new Date(order.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <span className={`ot-badge ot-badge-${order.status}`}>
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>

          {/* Прогресс-бар горизонтальный */}
          {!isCancelled && (
            <div className="ot-progress">
              {GUEST_STAGES.map((stage, idx) => {
                const isDone = idx <= activeStageIndex
                const isCurrent = idx === activeStageIndex
                return (
                  <div key={stage.id} className={`ot-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}>
                    <div className="ot-step-dot">
                      {isDone && <Icon name="check" size={12} />}
                    </div>
                    <span>{stage.label}</span>
                  </div>
                )
              })}
              <div className="ot-progress-line">
                <div className="ot-progress-fill" style={{ width: `${(activeStageIndex / 3) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Отменён */}
          {isCancelled && (
            <div className="ot-cancelled">
              <Icon name="close" size={20} />
              <span>Заказ отменён</span>
            </div>
          )}

          {/* Состав заказа */}
          <div className="ot-items">
            {order.restaurant_order_items.map((item, i) => (
              <div key={i} className="ot-item">
                <span className="ot-item-qty">{item.quantity}×</span>
                <span className="ot-item-name">{item.product_name}</span>
                <span className="ot-item-price">{formatUzs(item.line_total_uzs)}</span>
              </div>
            ))}
          </div>

          {/* Итого */}
          <div className="ot-total">
            <span>Итого</span>
            <strong>{formatUzs(order.total_uzs)}</strong>
          </div>

          {/* Кнопка отмены - только для новых заказов */}
          {order.status === 'new' && !cancelConfirmOpen && (
            <button className="ot-cancel-btn" onClick={() => setCancelConfirmOpen(true)}>
              Отменить заказ
            </button>
          )}

          {/* Подтверждение отмены */}
          {cancelConfirmOpen && (
            <div className="ot-cancel-confirm">
              <span>Отменить заказ?</span>
              {cancelError && <p className="ot-error-text">{cancelError}</p>}
              <div className="ot-cancel-actions">
                <button className="ot-btn-danger" disabled={cancelBusy} onClick={cancelOrder}>
                  {cancelBusy ? '...' : 'Да'}
                </button>
                <button className="ot-btn-secondary" disabled={cancelBusy} onClick={() => setCancelConfirmOpen(false)}>
                  Нет
                </button>
              </div>
            </div>
          )}

          {/* Отзыв */}
          {isCompleted && !reviewed && (
            <div className="ot-review">
              <span className="ot-review-title">Оцените заказ</span>
              <div className="ot-stars">
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    className={rating >= v ? 'is-on' : ''}
                    onClick={() => {
                      setRating(v)
                      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                        try { navigator.vibrate(5 + v * 2) } catch {}
                      }
                    }}
                  >
                    <Icon name="star" size={28} />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <>
                  <div className="ot-tags">
                    {REVIEW_TAGS.map(tag => (
                      <button
                        key={tag}
                        className={selectedTags.includes(tag) ? 'is-selected' : ''}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Комментарий (необязательно)"
                    maxLength={500}
                  />
                  {reviewError && <p className="ot-error-text">{reviewError}</p>}
                  <button className="ot-btn-primary" disabled={reviewBusy} onClick={sendReview}>
                    {reviewBusy ? 'Отправка...' : 'Отправить'}
                  </button>
                </>
              )}
            </div>
          )}

          {isCompleted && reviewed && (
            <div className="ot-thanks">
              <Icon name="check" size={20} />
              <span>Спасибо за отзыв!</span>
            </div>
          )}
        </div>

        {/* Единственная CTA кнопка внизу */}
        <Link href={menuHref} className="ot-cta">
          <Icon name="plus" size={18} />
          <span>Заказать ещё</span>
        </Link>

        <p className="ot-hint">Оплата официанту или на кассе</p>
      </div>
    </main>
  )
}
