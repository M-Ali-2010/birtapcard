'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Icon } from '@/components/ui/icons'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_NEXT,
  type RestaurantOrderRow,
  type RestaurantOrderStatus,
  type RestaurantRole,
  formatUzs,
} from '@/lib/restaurant/types'

export type Table = { id: string; table_number: string; active: boolean; note: string | null }
export type Category = {
  id: string
  name: string
  menu_products: {
    id: string
    name: string
    price_uzs: number
    available: boolean
    image_url: string | null
    portion: string | null
    is_popular: boolean
    is_new: boolean
  }[]
}
export type Review = {
  id: string
  rating: number
  sentiment: string | null
  comment: string | null
  tags?: string[]
  created_at: string
  restaurant_orders: { order_number: number } | null
  dining_tables: { table_number: string } | null
}
export type Member = {
  id: string
  user_id: string
  role: 'restaurant_admin' | 'staff' | 'kitchen'
  full_name: string | null
}

/* ─── Вспомогательная функция времени (elapsed time) ───────────────────────── */
function formatElapsedMinutes(createdAt: string): { text: string; isDelayed: boolean } {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return { text: 'Только что', isDelayed: false }
  if (minutes < 60) return { text: `${minutes} мин назад`, isDelayed: minutes >= 15 }
  const hours = Math.floor(minutes / 60)
  return { text: `${hours} ч назад`, isDelayed: true }
}

/* ═════════════════════════════════════════════════════════════════════════════
   1. РАЗДЕЛ ЗАКАЗОВ (ORDERS) С БЕЗОПАСНОЙ ОПЛАТОЙ И ТАЙМЕРАМИ (B4, B5)
   ═════════════════════════════════════════════════════════════════════════════ */
export function OrdersSection({
  orders,
  base,
  role,
  busy,
  hasLoaded,
  onUpdateOrder,
  onRefresh,
}: {
  orders: RestaurantOrderRow[]
  base: string
  role: RestaurantRole
  busy: boolean
  hasLoaded: boolean
  onUpdateOrder: (order: RestaurantOrderRow, status?: RestaurantOrderStatus, paymentMethod?: string) => Promise<void>
  onRefresh: () => void
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'active' | 'ready' | 'completed'>('all')

  // Безопасная модалка оплаты (B5)
  const [paymentModalOrder, setPaymentModalOrder] = useState<RestaurantOrderRow | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'terminal' | 'other'>('card')
  const [paymentBusy, setPaymentBusy] = useState(false)

  // Undo окно после записи оплаты
  const [undoPaymentInfo, setUndoPaymentInfo] = useState<{ order: RestaurantOrderRow; method: string } | null>(null)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Звуковое оповещение о новых заказах
  const prevNewOrdersCountRef = useRef<number>(0)
  useEffect(() => {
    const currentNewCount = orders.filter((o) => o.status === 'new').length
    if (prevNewOrdersCountRef.current !== 0 && currentNewCount > prevNewOrdersCountRef.current) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([30, 80, 30]) } catch {}
      }
    }
    prevNewOrdersCountRef.current = currentNewCount
  }, [orders])

  const liveOrders = useMemo(
    () => orders.filter((order) => !['completed', 'cancelled'].includes(order.status)),
    [orders],
  )

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders
    if (statusFilter === 'new') return orders.filter((o) => o.status === 'new')
    if (statusFilter === 'active') return orders.filter((o) => ['accepted', 'preparing'].includes(o.status))
    if (statusFilter === 'ready') return orders.filter((o) => o.status === 'ready')
    if (statusFilter === 'completed') return orders.filter((o) => ['delivered', 'completed', 'cancelled'].includes(o.status))
    return orders
  }, [orders, statusFilter])

  async function handleConfirmPayment() {
    if (!paymentModalOrder || paymentBusy) return
    setPaymentBusy(true)
    try {
      await onUpdateOrder(paymentModalOrder, undefined, selectedPaymentMethod)
      setUndoPaymentInfo({ order: paymentModalOrder, method: selectedPaymentMethod })
      setPaymentModalOrder(null)

      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
      undoTimeoutRef.current = setTimeout(() => {
        setUndoPaymentInfo(null)
      }, 7000)
    } finally {
      setPaymentBusy(false)
    }
  }

  return (
    <>
      <div className="ra-summary">
        <span>
          Активные заказы
          <strong>{liveOrders.length}</strong>
        </span>
        <span>
          Новые
          <strong>{orders.filter((order) => order.status === 'new').length}</strong>
        </span>
        <span>
          Сумма активных
          <strong>
            {formatUzs(liveOrders.reduce((sum, order) => sum + order.total_uzs, 0))}
          </strong>
        </span>
      </div>

      {/* Фильтры по статусам */}
      <div className="ra-order-filters">
        <button
          className={statusFilter === 'all' ? 'is-active' : ''}
          onClick={() => setStatusFilter('all')}
        >
          Все ({orders.length})
        </button>
        <button
          className={statusFilter === 'new' ? 'is-active' : ''}
          onClick={() => setStatusFilter('new')}
        >
          Новые ({orders.filter((o) => o.status === 'new').length})
        </button>
        <button
          className={statusFilter === 'active' ? 'is-active' : ''}
          onClick={() => setStatusFilter('active')}
        >
          В работе ({orders.filter((o) => ['accepted', 'preparing'].includes(o.status)).length})
        </button>
        <button
          className={statusFilter === 'ready' ? 'is-active' : ''}
          onClick={() => setStatusFilter('ready')}
        >
          Готовы ({orders.filter((o) => o.status === 'ready').length})
        </button>
        <button
          className={statusFilter === 'completed' ? 'is-active' : ''}
          onClick={() => setStatusFilter('completed')}
        >
          Завершены ({orders.filter((o) => ['delivered', 'completed', 'cancelled'].includes(o.status)).length})
        </button>
      </div>

      {/* Undo тост записи оплаты */}
      {undoPaymentInfo && (
        <div className="ra-undo-toast" role="status">
          <span>
            Оплата заказа №{undoPaymentInfo.order.order_number} записана (
            {undoPaymentInfo.method === 'cash' ? 'Наличные' : undoPaymentInfo.method === 'card' ? 'Карта' : 'Терминал'}
            )
          </span>
          <button
            onClick={async () => {
              if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
              setUndoPaymentInfo(null)
              try {
                await fetch(`${base}/orders`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: undoPaymentInfo.order.id, refund_payment: true }),
                })
                onRefresh()
              } catch {}
            }}
          >
            Отменить запись
          </button>
        </div>
      )}

      {/* Список заказов */}
      <div className="ra-order-list">
        {hasLoaded && filteredOrders.length === 0 && (
          <div className="ra-empty">
            В этом списке пока нет заказов. Новые заказы появятся здесь автоматически.
          </div>
        )}

        {filteredOrders.map((order) => {
          const elapsed = formatElapsedMinutes(order.created_at)
          const nextStatus = ORDER_STATUS_NEXT[order.status]

          return (
            <article
              key={order.id}
              className={`ra-order ${order.status === 'new' ? 'is-new' : ''} ${
                elapsed.isDelayed && order.status !== 'completed' && order.status !== 'cancelled'
                  ? 'is-delayed'
                  : ''
              }`}
            >
              <div className="ra-order-top">
                <strong>
                  №{order.order_number} · стол {order.dining_tables?.table_number ?? '—'}
                </strong>
                <span className={`ra-status status-${order.status}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="ra-order-time-row">
                <time>
                  {new Date(order.created_at).toLocaleString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: 'short',
                  })}
                </time>
                <span className={`ra-elapsed-badge ${elapsed.isDelayed ? 'is-delayed' : ''}`}>
                  <Icon name="clock" size={13} />
                  <span>{elapsed.text}</span>
                </span>
              </div>

              <ul>
                {order.restaurant_order_items.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.product_name} × {item.quantity}
                      {item.note && <small className="ra-item-note"> · «{item.note}»</small>}
                    </span>
                    <strong>{formatUzs(item.line_total_uzs)}</strong>
                  </li>
                ))}
              </ul>

              {order.customer_note && (
                <p className="ra-customer-note">
                  <Icon name="alert" size={14} />
                  <span>Комментарий гостя: {order.customer_note}</span>
                </p>
              )}

              <div className="ra-order-bottom">
                <strong>{formatUzs(order.total_uzs)}</strong>
                <span className={order.payment_status === 'paid' ? 'ra-paid-badge' : 'ra-unpaid-badge'}>
                  {order.payment_status === 'paid'
                    ? `Оплачено · ${order.payment_method ?? 'касса'}`
                    : 'Не оплачено'}
                </span>
              </div>

              <div className="ra-actions">
                {nextStatus && (
                  <button
                    className="ra-btn-next-status"
                    disabled={busy}
                    onClick={() => onUpdateOrder(order, nextStatus)}
                  >
                    → {ORDER_STATUS_LABELS[nextStatus]}
                  </button>
                )}

                {/* Безопасная кнопка оплаты (B5) — только не для роли kitchen */}
                {role !== 'kitchen' && order.payment_status !== 'paid' && order.status !== 'cancelled' && (
                  <button
                    className="ra-btn-pay"
                    disabled={busy}
                    onClick={() => setPaymentModalOrder(order)}
                  >
                    <Icon name="check" size={15} />
                    <span>Принять оплату</span>
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {/* Модальное окно подтверждения оплаты (B5) */}
      {paymentModalOrder && (
        <div
          className="rm-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPaymentModalOrder(null)
          }}
        >
          <div className="ra-payment-modal" role="dialog" aria-modal="true">
            <div className="ra-payment-modal-head">
              <h3>Приём оплаты</h3>
              <button
                className="ra-modal-close"
                onClick={() => setPaymentModalOrder(null)}
                aria-label="Закрыть"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="ra-payment-modal-info">
              <div className="ra-pay-row">
                <span>Заказ:</span>
                <strong>№{paymentModalOrder.order_number}</strong>
              </div>
              <div className="ra-pay-row">
                <span>Стол:</span>
                <strong>{paymentModalOrder.dining_tables?.table_number ?? '—'}</strong>
              </div>
              <div className="ra-pay-row ra-pay-total-row">
                <span>Сумма к оплате:</span>
                <strong>{formatUzs(paymentModalOrder.total_uzs)}</strong>
              </div>
            </div>

            <div className="ra-payment-methods">
              <span className="ra-methods-label">Способ оплаты:</span>
              <div className="ra-methods-grid">
                {[
                  { id: 'cash', label: 'Наличные', icon: '💵' },
                  { id: 'card', label: 'Карта', icon: '💳' },
                  { id: 'terminal', label: 'Терминал', icon: '📟' },
                  { id: 'other', label: 'Другой', icon: '🔄' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`ra-method-btn ${selectedPaymentMethod === m.id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedPaymentMethod(m.id as typeof selectedPaymentMethod)}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ra-payment-modal-actions">
              <button
                className="ra-btn-confirm-pay"
                disabled={paymentBusy}
                onClick={handleConfirmPayment}
              >
                {paymentBusy ? 'Записываем…' : 'Подтвердить оплату'}
              </button>
              <button
                className="ra-btn-cancel-pay"
                disabled={paymentBusy}
                onClick={() => setPaymentModalOrder(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   2. КУХОННЫЙ РЕЖИМ (KDS) С КРУПНЫМИ КНОПКАМИ И ТАЙМЕРАМИ (B6)
   ═════════════════════════════════════════════════════════════════════════════ */
export function KitchenSection({
  orders,
  busy,
  hasLoaded,
  onUpdateOrder,
}: {
  orders: RestaurantOrderRow[]
  busy: boolean
  hasLoaded: boolean
  onUpdateOrder: (order: RestaurantOrderRow, status?: RestaurantOrderStatus) => Promise<void>
}) {
  const kitchenOrders = useMemo(
    () => orders.filter((order) => ['new', 'accepted', 'preparing', 'ready'].includes(order.status)),
    [orders],
  )

  return (
    <>
      <div className="ra-summary ra-kitchen-summary">
        <span>
          Очередь кухни
          <strong>{kitchenOrders.length}</strong>
        </span>
        <span>
          Новые заказы
          <strong>{kitchenOrders.filter((o) => o.status === 'new').length}</strong>
        </span>
        <span>
          Готовятся
          <strong>{kitchenOrders.filter((o) => o.status === 'preparing').length}</strong>
        </span>
      </div>

      <div className="ra-kitchen-grid">
        {hasLoaded && kitchenOrders.length === 0 && (
          <div className="ra-empty ra-kitchen-empty">
            <Icon name="check" size={32} />
            <strong>Кухня свободна</strong>
            <span>Все блюда приготовлены. Новые заказы появятся автоматически со звуком.</span>
          </div>
        )}

        {kitchenOrders.map((order) => {
          const elapsed = formatElapsedMinutes(order.created_at)

          return (
            <article
              key={order.id}
              className={`ra-kds-card ${order.status === 'new' ? 'is-kds-new' : ''} ${
                elapsed.isDelayed ? 'is-kds-delayed' : ''
              }`}
            >
              <div className="ra-kds-head">
                <div>
                  <span className="ra-kds-table">Стол {order.dining_tables?.table_number ?? '—'}</span>
                  <h3>Заказ №{order.order_number}</h3>
                </div>
                <div className="ra-kds-time-pill">
                  <Icon name="clock" size={14} />
                  <span>{elapsed.text}</span>
                </div>
              </div>

              <div className="ra-kds-items">
                {order.restaurant_order_items.map((item) => (
                  <div className="ra-kds-item-row" key={item.id}>
                    <div className="ra-kds-item-qty">{item.quantity}×</div>
                    <div className="ra-kds-item-info">
                      <strong>{item.product_name}</strong>
                      {item.note && <span className="ra-kds-note">«{item.note}»</span>}
                    </div>
                  </div>
                ))}
              </div>

              {order.customer_note && (
                <div className="ra-kds-order-note">
                  <strong>Примечание:</strong> {order.customer_note}
                </div>
              )}

              <div className="ra-kds-actions">
                {order.status === 'new' && (
                  <button
                    className="ra-kds-btn ra-kds-btn-start"
                    disabled={busy}
                    onClick={() => onUpdateOrder(order, 'accepted')}
                  >
                    Принять в работу
                  </button>
                )}
                {order.status === 'accepted' && (
                  <button
                    className="ra-kds-btn ra-kds-btn-cook"
                    disabled={busy}
                    onClick={() => onUpdateOrder(order, 'preparing')}
                  >
                    Начать готовить
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    className="ra-kds-btn ra-kds-btn-ready"
                    disabled={busy}
                    onClick={() => onUpdateOrder(order, 'ready')}
                  >
                    Готово к подаче
                  </button>
                )}
                {order.status === 'ready' && (
                  <button
                    className="ra-kds-btn ra-kds-btn-deliver"
                    disabled={busy}
                    onClick={() => onUpdateOrder(order, 'delivered')}
                  >
                    Передано официанту
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   3. РАЗДЕЛ МЕНЮ С БЫСТРЫМ СТОП-ЛИСТОМ В 1 КЛИК (B7)
   ═════════════════════════════════════════════════════════════════════════════ */
export function MenuSection({
  categories,
  base,
  busy,
  onRefresh,
}: {
  categories: Category[]
  base: string
  busy: boolean
  onRefresh: () => void
}) {
  const [categoryName, setCategoryName] = useState('')
  const [newProduct, setNewProduct] = useState({
    category_id: '',
    name: '',
    price_uzs: '',
    description: '',
    portion: '',
    image_url: '',
  })
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  async function createCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryName.trim()) return
    setError('')
    const res = await fetch(`${base}/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'category', name: categoryName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? 'Не удалось создать категорию')
    else {
      setCategoryName('')
      onRefresh()
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!newProduct.name.trim() || !newProduct.price_uzs) return
    setError('')
    try {
      const res = await fetch(`${base}/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'product',
          ...newProduct,
          category_id: newProduct.category_id || categories[0]?.id,
          price_uzs: Number(newProduct.price_uzs),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewProduct({
        category_id: '',
        name: '',
        price_uzs: '',
        description: '',
        portion: '',
        image_url: '',
      })
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить блюдо')
    }
  }

  async function toggleProductAvailability(product: Category['menu_products'][number]) {
    const res = await fetch(`${base}/menu`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: product.id, available: !product.available }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Не удалось изменить статус блюда')
    } else {
      onRefresh()
    }
  }

  async function updateProductPrice(product: Category['menu_products'][number]) {
    const price = Number(priceDrafts[product.id] ?? product.price_uzs)
    if (!Number.isInteger(price) || price < 0) {
      setError('Цена должна быть целым положительным числом в сумах')
      return
    }
    const res = await fetch(`${base}/menu`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: product.id, price_uzs: price }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? 'Не удалось обновить цену')
    else {
      setPriceDrafts((drafts) => {
        const next = { ...drafts }
        delete next[product.id]
        return next
      })
      onRefresh()
    }
  }

  return (
    <>
      {error && <div className="ra-error" role="alert">{error}</div>}

      <div className="ra-menu-tools">
        {/* Добавление категории */}
        <form onSubmit={createCategory} className="ra-tool-card">
          <h3>Новая категория</h3>
          <div className="ra-form-inline">
            <input
              id="new-category"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              maxLength={100}
              placeholder="Например, Напитки"
              required
            />
            <button type="submit" disabled={!categoryName.trim()}>Добавить</button>
          </div>
        </form>

        {/* Добавление блюда */}
        <form onSubmit={createProduct} className="ra-product-form">
          <h3>Новое блюдо</h3>
          <div className="ra-product-form-grid">
            <label>
              <span>Категория</span>
              <select
                required
                value={newProduct.category_id || categories[0]?.id || ''}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, category_id: e.target.value }))}
              >
                <option value="" disabled>Выберите категорию</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Название блюда</span>
              <input
                required
                maxLength={100}
                value={newProduct.name}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Пицца Маргарита"
              />
            </label>

            <label>
              <span>Цена (сум)</span>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={newProduct.price_uzs}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, price_uzs: e.target.value }))}
                placeholder="65000"
              />
            </label>

            <label>
              <span>Порция</span>
              <input
                maxLength={40}
                value={newProduct.portion}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, portion: e.target.value }))}
                placeholder="400 г"
              />
            </label>
          </div>

          <label>
            <span>Описание</span>
            <input
              maxLength={600}
              value={newProduct.description}
              onChange={(e) => setNewProduct((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Соус помодоро, сыр моцарелла, базилик"
            />
          </label>

          <label>
            <span>Ссылка на фото (URL)</span>
            <input
              type="url"
              value={newProduct.image_url}
              onChange={(e) => setNewProduct((prev) => ({ ...prev, image_url: e.target.value }))}
              placeholder="https://..."
            />
          </label>

          <button className="ra-btn-submit" disabled={busy || !categories.length}>
            {busy ? 'Сохраняем…' : 'Добавить блюдо в меню'}
          </button>
        </form>
      </div>

      {/* Список блюд по категориям */}
      <div className="ra-menu">
        {categories.map((category) => (
          <section key={category.id} className="ra-menu-cat-card">
            <h2>{category.name}</h2>
            <div className="ra-menu-cat-list">
              {category.menu_products.map((product) => (
                <article key={product.id} className="ra-menu-row">
                  {product.image_url && (
                    <Image
                      src={product.image_url}
                      alt=""
                      width={56}
                      height={56}
                      unoptimized
                      className="ra-menu-img"
                    />
                  )}
                  <div className="ra-menu-meta">
                    <strong>{product.name}</strong>
                    <span>{product.portion ?? 'Порция'}</span>
                  </div>

                  <div className="ra-menu-price-box">
                    <input
                      className="ra-price-input"
                      type="number"
                      min="0"
                      step="1"
                      value={priceDrafts[product.id] ?? String(product.price_uzs)}
                      onChange={(e) =>
                        setPriceDrafts((drafts) => ({ ...drafts, [product.id]: e.target.value }))
                      }
                    />
                    <button
                      className="ra-price-save"
                      onClick={() => updateProductPrice(product)}
                      title="Сохранить цену"
                    >
                      ✓
                    </button>
                  </div>

                  {/* Быстрый стоп-лист в 1 клик (B7) */}
                  <button
                    className={`ra-btn-stoplist ${product.available ? 'is-available' : 'is-stopped'}`}
                    onClick={() => toggleProductAvailability(product)}
                  >
                    {product.available ? 'В меню' : 'В стоп-листе'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   4. РАЗДЕЛ СТОЛОВ, QR И NFC
   ═════════════════════════════════════════════════════════════════════════════ */
export function TablesSection({
  tables,
  slug,
  base,
  onRefresh,
}: {
  tables: Table[]
  slug: string
  base: string
  onRefresh: () => void
}) {
  const [tableNumber, setTableNumber] = useState('')
  const [error, setError] = useState('')
  const [qrData, setQrData] = useState<Record<string, string>>({})
  const [tableLinks, setTableLinks] = useState<Record<string, string>>({})
  const [nfcSupported, setNfcSupported] = useState(false)
  const [nfcBusyTableId, setNfcBusyTableId] = useState('')
  const [nfcFeedback, setNfcFeedback] = useState<Record<string, { kind: 'success' | 'error' | 'pending'; message: string }>>({})

  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    setNfcSupported(typeof window !== 'undefined' && window.isSecureContext && 'NDEFReader' in window)

    Promise.all(
      tables.map(async (table) => {
        const url = `${origin}/restaurant/${slug}/table/${encodeURIComponent(table.table_number)}`
        const qr = await QRCode.toDataURL(url, {
          width: 240,
          margin: 1,
          color: { dark: '#151714', light: '#ffffff' },
        })
        return [table.id, { url, qr }] as const
      }),
    )
      .then((pairs) => {
        setTableLinks(Object.fromEntries(pairs.map(([id, value]) => [id, value.url])))
        setQrData(Object.fromEntries(pairs.map(([id, value]) => [id, value.qr])))
      })
      .catch(() => setError('Не удалось сгенерировать QR-коды столов'))
  }, [slug, tables])

  async function addTable(e: React.FormEvent) {
    e.preventDefault()
    if (!tableNumber.trim()) return
    setError('')
    const res = await fetch(`${base}/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_number: tableNumber.trim() }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? 'Не удалось добавить стол')
    else {
      setTableNumber('')
      onRefresh()
    }
  }

  async function toggleTable(table: Table) {
    const res = await fetch(`${base}/tables`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: table.id, active: !table.active }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Не удалось обновить стол')
    } else {
      onRefresh()
    }
  }

  async function copyNfcLink(tableId: string) {
    const url = tableLinks[tableId]
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setNfcFeedback((c) => ({
        ...c,
        [tableId]: { kind: 'success', message: 'Ссылка скопирована для записи на метку.' },
      }))
    } catch {
      setNfcFeedback((c) => ({
        ...c,
        [tableId]: { kind: 'error', message: 'Не удалось скопировать автоматически.' },
      }))
    }
  }

  async function writeNfcLink(tableId: string) {
    const url = tableLinks[tableId]
    const NDEFReader = (window as Window & {
      NDEFReader?: new () => { write: (msg: { records: { recordType: 'url'; data: string }[] }) => Promise<void> }
    }).NDEFReader
    if (!url || !NDEFReader) return

    setNfcBusyTableId(tableId)
    setNfcFeedback((c) => ({
      ...c,
      [tableId]: { kind: 'pending', message: 'Поднесите NFC-метку к телефону…' },
    }))

    try {
      const writer = new NDEFReader()
      await writer.write({ records: [{ recordType: 'url', data: url }] })
      setNfcFeedback((c) => ({
        ...c,
        [tableId]: { kind: 'success', message: 'Готово! NFC-метка успешно записана.' },
      }))
    } catch {
      setNfcFeedback((c) => ({
        ...c,
        [tableId]: { kind: 'error', message: 'Не удалось записать метку. Проверьте NFC.' },
      }))
    } finally {
      setNfcBusyTableId('')
    }
  }

  return (
    <>
      {error && <div className="ra-error" role="alert">{error}</div>}

      <form onSubmit={addTable} className="ra-add-table">
        <label htmlFor="table-number">Новый стол</label>
        <input
          id="table-number"
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          maxLength={12}
          placeholder="Например, 10"
        />
        <button disabled={!tableNumber.trim()}>Добавить стол</button>
      </form>

      <div className="ra-tables">
        {tables.map((table) => (
          <article className="ra-table" key={table.id}>
            <div className="ra-table-header">
              <strong>Стол {table.table_number}</strong>
              <span className={table.active ? 'ra-badge-active' : 'ra-badge-disabled'}>
                {table.active ? 'Активен' : 'Отключён'}
              </span>
            </div>

            {qrData[table.id] && (
              <div className="ra-qr-container">
                <Image
                  src={qrData[table.id]}
                  alt={`QR-код стола ${table.table_number}`}
                  width={200}
                  height={200}
                  unoptimized
                />
              </div>
            )}

            <code className="ra-table-url" title={tableLinks[table.id]}>
              {tableLinks[table.id] ?? `/restaurant/${slug}/table/${table.table_number}`}
            </code>

            {nfcFeedback[table.id] && (
              <span className={`ra-nfc-feedback is-${nfcFeedback[table.id].kind}`}>
                {nfcFeedback[table.id].message}
              </span>
            )}

            <div className="ra-table-actions">
              <button onClick={() => copyNfcLink(table.id)}>Копировать ссылку NFC</button>
              {nfcSupported && (
                <button
                  disabled={nfcBusyTableId === table.id}
                  onClick={() => writeNfcLink(table.id)}
                >
                  {nfcBusyTableId === table.id ? 'Поднесите метку…' : 'Записать NFC-метку'}
                </button>
              )}
              <button onClick={() => toggleTable(table)}>
                {table.active ? 'Отключить' : 'Включить'}
              </button>
              <button onClick={() => window.print()}>Печать QR</button>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   5. РАЗДЕЛ ОТЗЫВОВ (FEEDBACK)
   ═════════════════════════════════════════════════════════════════════════════ */
export function FeedbackSection({
  reviews,
  hasLoaded,
}: {
  reviews: Review[]
  hasLoaded: boolean
}) {
  const avgRating = reviews.length
    ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1)
    : '—'

  return (
    <>
      <div className="ra-summary">
        <span>
          Средняя оценка
          <strong>{avgRating} / 5</strong>
        </span>
        <span>
          Всего отзывов
          <strong>{reviews.length}</strong>
        </span>
      </div>

      <div className="ra-reviews">
        {hasLoaded && !reviews.length && (
          <div className="ra-empty">
            Отзывов пока нет. Гости смогут оценить заказ после получения на столе.
          </div>
        )}

        {reviews.map((review) => (
          <article key={review.id} className="ra-review-card">
            <div className="ra-review-head">
              <div className="ra-review-stars">
                {Array.from({ length: 5 }, (_, i) => (
                  <Icon
                    key={i}
                    name="star"
                    size={16}
                    className={i < review.rating ? 'is-filled' : ''}
                  />
                ))}
              </div>
              <time>
                {new Date(review.created_at).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
            </div>

            {review.tags && review.tags.length > 0 && (
              <div className="ra-review-tags">
                {review.tags.map((t) => (
                  <span key={t} className="ra-review-tag-pill">{t}</span>
                ))}
              </div>
            )}

            <p className="ra-review-comment">{review.comment || 'Без текстового комментария'}</p>
            <small>
              Заказ №{review.restaurant_orders?.order_number ?? '—'} · стол{' '}
              {review.dining_tables?.table_number ?? '—'}
            </small>
          </article>
        ))}
      </div>
    </>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   6. РАЗДЕЛ КОМАНДЫ (TEAM)
   ═════════════════════════════════════════════════════════════════════════════ */
export function TeamSection({
  members,
  base,
  busy,
  hasLoaded,
  onRefresh,
}: {
  members: Member[]
  base: string
  busy: boolean
  hasLoaded: boolean
  onRefresh: () => void
}) {
  const [staffEmail, setStaffEmail] = useState('')
  const [staffRole, setStaffRole] = useState<Member['role']>('staff')
  const [error, setError] = useState('')

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!staffEmail.trim()) return
    setError('')
    try {
      const res = await fetch(`${base}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: staffEmail.trim(), role: staffRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStaffEmail('')
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось назначить доступ')
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!window.confirm('Отозвать доступ у этого сотрудника?')) return
    setError('')
    const res = await fetch(`${base}/staff?user_id=${userId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? 'Не удалось отозвать доступ')
    else onRefresh()
  }

  return (
    <>
      {error && <div className="ra-error" role="alert">{error}</div>}

      <form className="ra-add-table ra-staff-form" onSubmit={handleAddMember}>
        <label htmlFor="staff-email">Добавить сотрудника по email</label>
        <input
          id="staff-email"
          type="email"
          required
          value={staffEmail}
          onChange={(e) => setStaffEmail(e.target.value)}
          placeholder="colleague@example.com"
        />
        <select
          aria-label="Роль сотрудника"
          value={staffRole}
          onChange={(e) => setStaffRole(e.target.value as Member['role'])}
        >
          <option value="staff">Сотрудник зала</option>
          <option value="kitchen">Кухня (KDS)</option>
          <option value="restaurant_admin">Администратор</option>
        </select>
        <button disabled={busy || !staffEmail.trim()}>
          {busy ? 'Назначаем…' : 'Назначить доступ'}
        </button>
        <small>Сотрудник должен иметь зарегистрированный аккаунт BirTapCard.</small>
      </form>

      <div className="ra-members-list">
        {hasLoaded && !members.length && (
          <div className="ra-empty">Пока нет назначенных сотрудников.</div>
        )}

        {members.map((member) => (
          <article className="ra-member" key={member.id}>
            <div>
              <strong>{member.full_name || 'Сотрудник'}</strong>
              <span className={`ra-role-pill is-${member.role}`}>
                {member.role === 'restaurant_admin'
                  ? 'Администратор'
                  : member.role === 'kitchen'
                  ? 'Кухня (KDS)'
                  : 'Сотрудник зала'}
              </span>
            </div>
            <code>{member.user_id}</code>
            <button
              disabled={busy}
              onClick={() => handleRemoveMember(member.user_id)}
            >
              Отозвать доступ
            </button>
          </article>
        ))}
      </div>
    </>
  )
}
