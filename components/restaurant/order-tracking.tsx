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

const GUEST_STAGES: { id: RestaurantOrderStatus; label: string; desc: string }[] = [
  { id: 'accepted', label: 'Принят', desc: 'Заказ передан в работу' },
  { id: 'preparing', label: 'Готовится', desc: 'Повара готовят блюда' },
  { id: 'ready', label: 'Готов', desc: 'Официант несёт ваш заказ' },
  { id: 'delivered', label: 'Подан', desc: 'Приятного аппетита!' },
]

const REVIEW_TAGS = [
  'Вкусно',
  'Быстрая подача',
  'Горячее',
  'Красивая подача',
  'Отличный сервис',
  'Вежливый персонал',
]

export default function OrderTracking({ token }: { token: string }) {
  const router = useRouter()
  const [order, setOrder] = useState<OrderData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)

  // Review states
  const [rating, setRating] = useState(0)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewError, setReviewError] = useState('')

  // Cancel order state
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
          if (result.has_review) {
            setReviewed(true)
          }
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
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [token, retry])

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
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
        // If already reviewed, switch to reviewed state so user is never stuck
        if (response.status === 409 && result.error?.includes('уже оценили')) {
          setReviewed(true)
          return
        }
        throw new Error(result.error ?? 'Не удалось отправить оценку')
      }
      setReviewed(true)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(20) } catch {}
      }
    } catch (caught) {
      setReviewError(caught instanceof Error ? caught.message : 'Проверьте подключение и попробуйте ещё раз')
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
      if (!response.ok) throw new Error(result.error ?? 'Не удалось отменить заказ')
      setCancelConfirmOpen(false)
      setOrder((prev) => (prev ? { ...prev, status: 'cancelled' } : null))
      if (order?.restaurants?.slug && order?.dining_tables?.table_number) {
        updateGuestOrderStatus(
          order.restaurants.slug,
          order.dining_tables.table_number,
          token,
          'cancelled',
        )
      }
    } catch (caught) {
      setCancelError(caught instanceof Error ? caught.message : 'Не удалось отменить заказ')
    } finally {
      setCancelBusy(false)
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
          <span className="rt-state-icon"><Icon name="alert" size={26} /></span>
          <h1>Не удалось открыть заказ</h1>
          <p>{error || 'Проверьте ссылку и подключение к интернету.'}</p>
          <div className="rt-error-actions">
            <button className="rt-send" onClick={() => { setLoading(true); setRetry((v) => v + 1) }}>
              Попробовать снова
            </button>
            <button className="rt-back-link" onClick={() => router.back()}>
              Вернуться назад
            </button>
          </div>
        </section>
      </main>
    )
  }

  const menuHref = order.restaurants && order.dining_tables
    ? `/restaurant/${order.restaurants.slug}/table/${order.dining_tables.table_number}`
    : '/'

  // Mapping internal order status to 4 guest stages
  let activeStageIndex = 0
  if (order.status === 'new' || order.status === 'accepted') activeStageIndex = 0
  else if (order.status === 'preparing') activeStageIndex = 1
  else if (order.status === 'ready') activeStageIndex = 2
  else if (order.status === 'delivered' || order.status === 'completed') activeStageIndex = 3

  return (
    <main className="rt-page">
      {/* 1. Постоянная заметная шапка с большой кнопкой НАЗАД В МЕНЮ (A1) */}
      <header className="rt-nav-header">
        <Link href={menuHref} className="rt-nav-back">
          <Icon name="arrowLeft" size={18} />
          <span>← Назад в меню</span>
        </Link>
        <div className="rt-nav-info">
          <strong>{order.restaurants?.name ?? 'Ресторан'}</strong>
          <span>Стол {order.dining_tables?.table_number ?? '—'}</span>
        </div>
      </header>

      <section className="rt-card">
        <div className="rt-order-heading">
          <div>
            <h1>Заказ №{order.order_number}</h1>
            <p>
              Стол {order.dining_tables?.table_number ?? '—'} ·{' '}
              {new Date(order.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span className={'rt-status rt-status-' + order.status}>
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>

        {order.status === 'cancelled' ? (
          <div className="rt-cancel">
            <Icon name="alert" size={22} />
            <div>
              <strong>Заказ отменён</strong>
              <p>Если это произошло по ошибке, обратитесь к официанту или оформите новый заказ в меню.</p>
            </div>
          </div>
        ) : (
          <div className="rt-timeline-box">
            <ol className="rt-steps" aria-label="Этапы заказа">
              {GUEST_STAGES.map((step, idx) => {
                const isDone = idx <= activeStageIndex
                const isCurrent = idx === activeStageIndex
                return (
                  <li
                    key={step.id}
                    className={isDone ? 'is-done' : ''}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <span className="rt-step-marker">
                      {isDone && <Icon name="check" size={13} />}
                    </span>
                    <div className="rt-step-text">
                      <strong>{step.label}</strong>
                      <small>{step.desc}</small>
                    </div>
                  </li>
                )
              })}
            </ol>

            {order.status === 'new' && (
              <div className="rt-cancel-guest-box">
                {cancelConfirmOpen ? (
                  <div className="rt-cancel-confirm">
                    <p>Отменить этот заказ?</p>
                    {cancelError && <p className="rt-review-error">{cancelError}</p>}
                    <div className="rt-cancel-btns">
                      <button
                        className="rt-btn-cancel-action"
                        disabled={cancelBusy}
                        onClick={cancelOrder}
                      >
                        {cancelBusy ? 'Отменяем…' : 'Да, отменить'}
                      </button>
                      <button
                        className="rt-btn-cancel-back"
                        disabled={cancelBusy}
                        onClick={() => setCancelConfirmOpen(false)}
                      >
                        Оставить заказ
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="rt-cancel-trigger"
                    onClick={() => setCancelConfirmOpen(true)}
                  >
                    Отменить заказ
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Состав заказа */}
        <section className="rt-order-items" aria-label="Состав заказа">
          <h2>Состав заказа</h2>
          {order.restaurant_order_items.map((item, index) => (
            <div className="rt-item" key={index}>
              <span>
                {item.product_name}
                <small> × {item.quantity}</small>
              </span>
              <strong>{formatUzs(item.line_total_uzs)}</strong>
            </div>
          ))}
        </section>

        <div className="rt-total">
          <div>
            <span>Итого к оплате</span>
            <small>Оплата официанту или на кассе</small>
          </div>
          <strong>{formatUzs(order.total_uzs)}</strong>
        </div>

        <p className="rt-refresh">
          <span className="rt-live-dot" />
          Статус обновляется автоматически каждые 5 сек
        </p>

        {/* Прямой блок действий в теле страницы: Назад в меню и Заказать ещё */}
        <div className="rt-inline-nav-box">
          <Link href={menuHref} className="rt-btn-menu-highlight">
            <Icon name="arrowLeft" size={18} />
            <span>Вернуться в меню стола {order.dining_tables?.table_number ?? ''}</span>
          </Link>
          <Link href={menuHref} className="rt-btn-reorder-highlight">
            <Icon name="plus" size={18} />
            <span>Дозаказать ещё блюда</span>
          </Link>
        </div>

        {/* Отзыв после получения (A9, A1) */}
        {['delivered', 'completed'].includes(order.status) && (
          <div className="rt-review">
            <h2>Как вам заказ?</h2>
            {reviewed ? (
              <div className="rt-thanks-block">
                <div className="rt-thanks-icon">
                  <Icon name="check" size={28} />
                </div>
                <h3>Спасибо за ваш отзыв!</h3>
                <p>Ваша оценка сохранена. Приятного отдыха в нашем заведении!</p>
                <div className="rt-thanks-actions">
                  <Link href={menuHref} className="rt-send rt-thanks-reorder">
                    <Icon name="plus" size={16} />
                    <span>Заказать ещё</span>
                  </Link>
                  <Link href={menuHref} className="rt-secondary-btn">
                    <Icon name="arrowLeft" size={16} />
                    <span>Вернуться в меню</span>
                  </Link>
                </div>
                <div className="rt-bill-hint">
                  <Icon name="clock" size={16} />
                  <span>Оплата производится у официанта или на кассе</span>
                </div>
              </div>
            ) : (
              <>
                <p>Оцените блюда и обслуживание</p>
                <div className="rt-stars" role="group" aria-label="Оценка заказа">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={rating === value}
                      aria-label={`${value} из 5 звёзд`}
                      className={rating >= value ? 'is-on' : ''}
                      onClick={() => setRating(value)}
                    >
                      <Icon name="star" size={28} />
                    </button>
                  ))}
                </div>

                {rating > 0 && (
                  <div className="rt-tags-picker">
                    <span className="rt-tags-title">Что понравилось?</span>
                    <div className="rt-tags-list">
                      {REVIEW_TAGS.map((tag) => {
                        const isSelected = selectedTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            className={`rt-tag-chip ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => toggleTag(tag)}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <label className="sr-only" htmlFor="review-comment">Комментарий к отзыву</label>
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={2000}
                  placeholder="Ваш комментарий (по желанию)"
                />
                {reviewError && <p className="rt-review-error" role="alert">{reviewError}</p>}
                <button
                  className="rt-send"
                  disabled={!rating || reviewBusy}
                  onClick={sendReview}
                >
                  {reviewBusy ? 'Отправляем…' : 'Отправить отзыв'}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {/* Постоянная нижняя панель действий (A1) */}
      <footer className="rt-bottom-bar">
        <Link href={menuHref} className="rt-bottom-reorder">
          <Icon name="plus" size={17} />
          <span>Заказать ещё</span>
        </Link>
        <Link href={menuHref} className="rt-bottom-menu">
          <Icon name="arrowLeft" size={16} />
          <span>В меню</span>
        </Link>
      </footer>
    </main>
  )
}
