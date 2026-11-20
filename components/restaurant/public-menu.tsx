'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icons'
import type {
  PublicProduct,
  PublicRestaurantMenu,
  GuestOrderSummary,
} from '@/lib/restaurant/types'
import {
  ORDER_STATUS_LABELS,
  KNOWN_ALLERGENS,
  formatUzs,
} from '@/lib/restaurant/types'
import {
  getGuestSession,
  saveGuestCart,
  clearGuestCart,
  saveGuestAllergenFilters,
  addGuestOrder,
  getActiveOrderForBanner,
} from '@/lib/restaurant/guest-session'

type CartLine = { product: PublicProduct; quantity: number; note?: string }

export default function RestaurantMenu({ menu }: { menu: PublicRestaurantMenu }) {
  const router = useRouter()
  const slug = menu.restaurant.slug
  const tableNumber = menu.table.table_number

  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [selectedCategory, setSelectedCategory] = useState(menu.categories[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [generalNote, setGeneralNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [ordersSheetOpen, setOrdersSheetOpen] = useState(false)
  const [activeOrder, setActiveOrder] = useState<GuestOrderSummary | null>(null)
  const [allOrders, setAllOrders] = useState<GuestOrderSummary[]>([])
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([])
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  // Detail sheet state
  const [detailProduct, setDetailProduct] = useState<PublicProduct | null>(null)
  const [detailNote, setDetailNote] = useState('')

  // Undo delete state
  const [undoDeletedItem, setUndoDeletedItem] = useState<{ id: string; line: CartLine } | null>(null)
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Network state
  const [isOnline, setIsOnline] = useState(true)

  const cartButtonRef = useRef<HTMLButtonElement>(null)
  const cartDialogRef = useRef<HTMLElement>(null)

  // All available products flat map for quick lookup
  const productsMap = useMemo(() => {
    const map = new Map<string, PublicProduct>()
    for (const cat of menu.categories) {
      for (const prod of cat.menu_products) {
        map.set(prod.id, prod)
      }
    }
    return map
  }, [menu.categories])

  // Initialize guest session and load cart & active orders
  useEffect(() => {
    const session = getGuestSession(slug, tableNumber)
    setActiveOrder(getActiveOrderForBanner(slug, tableNumber))
    setAllOrders(session.activeOrders)
    setSelectedAllergens(session.activeAllergenFilters)

    // Reconstruct valid cart lines
    const restoredCart: Record<string, CartLine> = {}
    for (const [prodId, item] of Object.entries(session.cart)) {
      const prod = productsMap.get(prodId)
      if (prod && prod.available) {
        restoredCart[prodId] = {
          product: prod,
          quantity: item.quantity,
          note: item.note,
        }
      }
    }
    setCart(restoredCart)

    // Sync across tabs & storage changes
    const onSessionChange = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.slug === slug && customEvent.detail?.table === tableNumber) {
        setActiveOrder(getActiveOrderForBanner(slug, tableNumber))
        setAllOrders(customEvent.detail.session.activeOrders || [])
      }
    }

    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    window.addEventListener('guest-session-change', onSessionChange)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }

    return () => {
      window.removeEventListener('guest-session-change', onSessionChange)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [slug, tableNumber, productsMap])

  // Save cart to localStorage whenever it changes
  function updateCartState(newCart: Record<string, CartLine>) {
    setCart(newCart)
    const serialized: Record<string, { productId: string; quantity: number; note?: string }> = {}
    for (const [id, line] of Object.entries(newCart)) {
      serialized[id] = {
        productId: line.product.id,
        quantity: line.quantity,
        note: line.note,
      }
    }
    saveGuestCart(slug, tableNumber, serialized)
  }

  // Accessibility & modal focus trap for cart
  useEffect(() => {
    if (!cartOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCartOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [cartOpen])

  const lines = Object.values(cart)
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce((sum, line) => sum + line.product.price_uzs * line.quantity, 0)

  // Allergen toggle
  function toggleAllergen(id: string) {
    const next = selectedAllergens.includes(id)
      ? selectedAllergens.filter((item) => item !== id)
      : [...selectedAllergens, id]
    setSelectedAllergens(next)
    saveGuestAllergenFilters(slug, tableNumber, next)
  }

  // Filtering products by query and allergens
  const visibleCategories = useMemo(() => {
    return menu.categories
      .map((category) => ({
        ...category,
        menu_products: category.menu_products.filter((product) => {
          // Allergen exclusion filter
          if (selectedAllergens.length > 0 && product.allergens?.length) {
            const hasExcludedAllergen = product.allergens.some((a) =>
              selectedAllergens.includes(a.toLowerCase()),
            )
            if (hasExcludedAllergen) return false
          }
          // Search query
          if (!query) return true
          const searchHaystack = `${product.name} ${product.description ?? ''} ${product.ingredients ?? ''}`.toLowerCase()
          return searchHaystack.includes(query.toLowerCase())
        }),
      }))
      .filter((category) => category.menu_products.length > 0)
  }, [menu.categories, query, selectedAllergens])

  // Category scroll spy
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.rm-category'))
    if (!sections.length || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      (entries) => {
        const firstVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (firstVisible) setSelectedCategory(firstVisible.target.id.replace('category-', ''))
      },
      { rootMargin: '-145px 0px -68% 0px' },
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [visibleCategories])

  function changeQuantity(product: PublicProduct, delta: number, customNote?: string) {
    const next = { ...cart }
    const currentLine = next[product.id]
    const quantity = (currentLine?.quantity ?? 0) + delta

    if (quantity <= 0) {
      if (currentLine) {
        setUndoDeletedItem({ id: product.id, line: currentLine })
        if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
        undoTimeoutRef.current = setTimeout(() => setUndoDeletedItem(null), 4000)
      }
      delete next[product.id]
    } else {
      next[product.id] = {
        product,
        quantity,
        note: customNote !== undefined ? customNote : currentLine?.note,
      }
    }
    updateCartState(next)
  }

  function restoreDeletedItem() {
    if (!undoDeletedItem) return
    const next = { ...cart, [undoDeletedItem.id]: undoDeletedItem.line }
    updateCartState(next)
    setUndoDeletedItem(null)
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current)
  }

  function handleClearCart() {
    if (window.confirm('Очистить все блюда из заказа?')) {
      updateCartState({})
      clearGuestCart(slug, tableNumber)
    }
  }

  function openProductDetail(product: PublicProduct) {
    setDetailProduct(product)
    setDetailNote(cart[product.id]?.note ?? '')
  }

  async function submit() {
    if (!lines.length || busy || !isOnline) return
    setBusy(true)
    setError('')

    const clientRequestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : undefined

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch('/api/restaurant/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          slug,
          table: tableNumber,
          client_request_id: clientRequestId,
          items: lines.map(({ product, quantity, note }) => ({
            product_id: product.id,
            quantity,
            note: note || undefined,
            modifier_ids: [],
          })),
          note: generalNote,
        }),
      })

      clearTimeout(timeoutId)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? 'Не удалось оформить заказ')
      }

      // Haptic celebration (A7)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([15, 60, 15]) } catch {}
      }

      // Save order to guest session
      addGuestOrder(slug, tableNumber, {
        token: result.tracking_token,
        orderNumber: result.order_number,
        totalUzs: result.total_uzs ?? total,
        createdAt: new Date().toISOString(),
        status: 'new',
      })

      // Clear local cart
      setCart({})

      // Seamless navigation without returning to cart on back
      router.replace('/restaurant/order/' + result.tracking_token)
    } catch (caught: unknown) {
      clearTimeout(timeoutId)
      if (caught instanceof Error && caught.name === 'AbortError') {
        setError('Связь слабая или сервер не отвечает. Проверьте интернет и нажмите «Повторить попытку».')
      } else {
        setError(caught instanceof Error ? caught.message : 'Проверьте подключение и попробуйте ещё раз')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="rm-page">
      {/* Офлайн баннер */}
      {!isOnline && (
        <div className="rm-offline-banner" role="alert">
          <Icon name="alert" size={16} />
          <span>Нет подключения к интернету. Меню доступно для просмотра.</span>
        </div>
      )}

      {/* Закреплённый баннер активного заказа (A1) */}
      {activeOrder && (
        <div className="rm-active-order-banner">
          <div className="rm-active-order-text">
            <span className="rm-live-pulse" />
            <span>
              Заказ №{activeOrder.orderNumber} · {ORDER_STATUS_LABELS[activeOrder.status] ?? 'Готовится'}
            </span>
          </div>
          <Link href={'/restaurant/order/' + activeOrder.token} className="rm-active-order-link">
            Статус заказа →
          </Link>
        </div>
      )}

      {/* Шапка меню */}
      <header className="rm-head">
        {menu.restaurant.cover_url && (
          <div
            className="rm-cover"
            aria-hidden="true"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(14, 15, 17, .18), var(--bg)), url("' +
                menu.restaurant.cover_url +
                '")',
            }}
          />
        )}
        <div className="rm-head-main">
          <div className="rm-brand">
            {menu.restaurant.logo_url && !failedImages.logo ? (
              <Image
                src={menu.restaurant.logo_url}
                alt=""
                width={48}
                height={48}
                unoptimized
                onError={() => setFailedImages((img) => ({ ...img, logo: true }))}
              />
            ) : (
              <span className="rm-mark" aria-hidden="true">
                {menu.restaurant.name.slice(0, 1)}
              </span>
            )}
            <span>МЕНЮ <i aria-hidden="true" /> СТОЛ {menu.table.table_number}</span>
          </div>
          <h1>{menu.restaurant.name}</h1>
          {menu.restaurant.description && <p>{menu.restaurant.description}</p>}
          {menu.restaurant.address && (
            <div className="rm-address">
              <Icon name="branches" size={15} />
              <span>{menu.restaurant.address}</span>
            </div>
          )}

          {allOrders.length > 0 && (
            <button
              className="rm-my-orders-btn"
              onClick={() => setOrdersSheetOpen(true)}
              aria-label="Мои заказы"
            >
              <Icon name="clock" size={14} />
              <span>Мои заказы ({allOrders.length})</span>
            </button>
          )}
        </div>
      </header>

      <div className="rm-content">
        {/* Поиск блюд */}
        <div className="rm-search">
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor="menu-search">Найти блюдо</label>
          <input
            id="menu-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти блюдо или ингредиент"
            autoComplete="off"
          />
          {query && (
            <button
              className="rm-search-clear"
              onClick={() => setQuery('')}
              aria-label="Очистить поиск"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {/* Фильтр по аллергенам (A5) */}
        <div className="rm-allergens-bar" aria-label="Фильтр аллергенов">
          <span className="rm-allergens-title">Исключить:</span>
          <div className="rm-allergens-scroll">
            {KNOWN_ALLERGENS.map((item) => {
              const active = selectedAllergens.includes(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`rm-allergen-chip ${active ? 'is-active' : ''}`}
                  onClick={() => toggleAllergen(item.id)}
                  aria-pressed={active}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>Без {item.label.toLowerCase()}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Навигация по категориям */}
        {visibleCategories.length > 0 && (
          <nav className="rm-categories" aria-label="Категории меню">
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                className={selectedCategory === category.id ? 'is-selected' : ''}
                aria-pressed={selectedCategory === category.id}
                onClick={() => {
                  setSelectedCategory(category.id)
                  document
                    .getElementById('category-' + category.id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                {category.name}
              </button>
            ))}
          </nav>
        )}

        {/* Список блюд по категориям */}
        <div className="rm-menu-list">
          {visibleCategories.map((category, categoryIndex) => (
            <section key={category.id} id={'category-' + category.id} className="rm-category">
              <div className="rm-category-heading">
                <h2>{category.name}</h2>
                {category.description && <p>{category.description}</p>}
              </div>
              <div className="rm-products">
                {category.menu_products.map((product, productIndex) => (
                  <article className="rm-product" key={product.id}>
                    <div
                      className="rm-product-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => openProductDetail(product)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openProductDetail(product)
                        }
                      }}
                      aria-label={`Подробнее о блюде ${product.name}`}
                    >
                      {product.image_url && !failedImages[product.id] ? (
                        <Image
                          className="rm-product-image"
                          src={product.image_url}
                          alt=""
                          width={640}
                          height={420}
                          sizes="(max-width: 760px) 112px, (max-width: 1100px) 45vw, 480px"
                          loading={categoryIndex === 0 && productIndex < 2 ? 'eager' : 'lazy'}
                          unoptimized
                          onError={() => setFailedImages((img) => ({ ...img, [product.id]: true }))}
                        />
                      ) : (
                        <div className="rm-product-placeholder" aria-hidden="true">
                          <Icon name="restaurants" size={26} />
                        </div>
                      )}
                    </div>

                    <div className="rm-product-info">
                      <div className="rm-product-top" onClick={() => openProductDetail(product)}>
                        <h3>{product.name}</h3>
                        <div className="rm-product-tags">
                          {product.is_popular && <span className="is-popular">Хит</span>}
                          {!product.is_popular && product.is_new && <span className="is-new">Новинка</span>}
                        </div>
                      </div>

                      {product.description && (
                        <p className="rm-product-desc" onClick={() => openProductDetail(product)}>
                          {product.description}
                        </p>
                      )}

                      <div className="rm-product-meta">
                        {[
                          product.portion,
                          product.preparation_minutes ? product.preparation_minutes + ' мин' : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>

                      {product.allergens && product.allergens.length > 0 && (
                        <div className="rm-card-allergens">
                          {product.allergens.map((alg) => (
                            <span key={alg} className="rm-card-allergen-tag">
                              {alg}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="rm-product-bottom">
                        <strong>{formatUzs(product.price_uzs)}</strong>
                        {cart[product.id] ? (
                          <div
                            className="rm-stepper"
                            aria-label={`${product.name}, ${cart[product.id].quantity} шт.`}
                          >
                            <button
                              aria-label={'Убрать ' + product.name}
                              onClick={() => changeQuantity(product, -1)}
                            >
                              <Icon name="minus" size={15} />
                            </button>
                            <span aria-live="polite">{cart[product.id].quantity}</span>
                            <button
                              aria-label={'Добавить ' + product.name}
                              onClick={() => changeQuantity(product, 1)}
                            >
                              <Icon name="plus" size={15} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="rm-add"
                            onClick={() => changeQuantity(product, 1)}
                          >
                            <Icon name="plus" size={15} />
                            <span>В заказ</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          {!visibleCategories.length && (
            <div className="rm-empty" role="status">
              <Icon name="search" size={24} />
              <strong>{query || selectedAllergens.length ? 'Ничего не найдено' : 'Меню скоро появится'}</strong>
              <span>
                {query || selectedAllergens.length
                  ? 'Попробуйте изменить поисковый запрос или сбросить фильтры аллергенов.'
                  : 'Пока в меню нет доступных блюд.'}
              </span>
              {(query || selectedAllergens.length > 0) && (
                <button
                  className="rm-reset-btn"
                  onClick={() => {
                    setQuery('')
                    setSelectedAllergens([])
                    saveGuestAllergenFilters(slug, tableNumber, [])
                  }}
                >
                  Сбросить все фильтры
                </button>
              )}
            </div>
          )}
        </div>

        {/* Дисклеймер об аллергенах */}
        <div className="rm-disclaimer">
          <Icon name="alert" size={15} />
          <span>Если у вас есть аллергия или непереносимость продуктов, обязательно сообщите официанту.</span>
        </div>

        <footer className="rm-footer">
          <span>BirTapCard Restaurant Service</span>
          <small>Быстрый заказ со стола</small>
        </footer>
      </div>

      {/* Всплывающий тост отмены удаления позиции */}
      {undoDeletedItem && (
        <div className="rm-undo-toast" role="status">
          <span>Удалено: {undoDeletedItem.line.product.name}</span>
          <button onClick={restoreDeletedItem}>Отменить</button>
        </div>
      )}

      {/* Плавающая кнопка корзины */}
      {count > 0 && (
        <button
          className="rm-cart-bar"
          ref={cartButtonRef}
          onClick={() => setCartOpen(true)}
          aria-label={`Открыть заказ, ${count} позиций на сумму ${formatUzs(total)}`}
        >
          <span className="rm-cart-count">{count}</span>
          <span className="rm-cart-bar-label">Открыть заказ</span>
          <strong>{formatUzs(total)}</strong>
          <Icon name="chevronRight" size={18} />
        </button>
      )}

      {/* Шторка корзины (A6) */}
      {cartOpen && (
        <div
          className="rm-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCartOpen(false)
          }}
        >
          <section
            className="rm-cart"
            ref={cartDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <div className="rm-cart-grip" aria-hidden="true" />
            <div className="rm-cart-head">
              <div>
                <h2 id="cart-title">Ваш заказ</h2>
                <p>
                  Стол <strong>{menu.table.table_number}</strong> · {count}{' '}
                  {count === 1 ? 'позиция' : count < 5 ? 'позиции' : 'позиций'}
                </p>
              </div>
              <div className="rm-cart-head-actions">
                {lines.length > 0 && (
                  <button
                    className="rm-cart-clear-btn"
                    onClick={handleClearCart}
                    title="Очистить корзину"
                  >
                    Очистить
                  </button>
                )}
                <button
                  className="rm-cart-close"
                  aria-label="Закрыть корзину"
                  onClick={() => setCartOpen(false)}
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
            </div>

            <div className="rm-cart-lines">
              {!lines.length && (
                <div className="rm-cart-empty">
                  <Icon name="restaurants" size={26} />
                  <span>В заказе пока нет блюд.</span>
                  <button onClick={() => setCartOpen(false)}>Вернуться к меню</button>
                </div>
              )}
              {lines.map(({ product, quantity, note }) => (
                <div className="rm-cart-line" key={product.id}>
                  <div className="rm-cart-line-main">
                    <strong>{product.name}</strong>
                    <small>{formatUzs(product.price_uzs)} за шт.</small>
                    {note && <span className="rm-cart-line-note">«{note}»</span>}
                  </div>
                  <div className="rm-cart-line-end">
                    <div className="rm-stepper">
                      <button
                        aria-label={'Убрать ' + product.name}
                        onClick={() => changeQuantity(product, -1)}
                      >
                        <Icon name="minus" size={14} />
                      </button>
                      <span aria-live="polite">{quantity}</span>
                      <button
                        aria-label={'Добавить ' + product.name}
                        onClick={() => changeQuantity(product, 1)}
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                    <strong>{formatUzs(product.price_uzs * quantity)}</strong>
                  </div>
                </div>
              ))}
            </div>

            {lines.length > 0 && (
              <>
                <label className="rm-note">
                  <span>Общий комментарий к заказу</span>
                  <textarea
                    value={generalNote}
                    onChange={(event) => setGeneralNote(event.target.value)}
                    maxLength={1000}
                    placeholder="Например, подать все блюда одновременно"
                  />
                </label>

                {error && (
                  <div className="rm-error-box" role="alert">
                    <p>{error}</p>
                    <button className="rm-retry-btn" onClick={submit}>
                      Повторить попытку
                    </button>
                  </div>
                )}

                <div className="rm-cart-table-badge">
                  <span>Заказ будет отправлен для:</span>
                  <strong>Стол {menu.table.table_number}</strong>
                </div>

                <div className="rm-cart-total">
                  <span>Итого к оплате</span>
                  <strong>{formatUzs(total)}</strong>
                </div>

                <button
                  className="rm-submit"
                  disabled={busy || !lines.length || !isOnline}
                  onClick={submit}
                >
                  {busy ? (
                    <>
                      <span className="rm-spinner" aria-hidden="true" />
                      Отправляем на кухню…
                    </>
                  ) : (
                    'Отправить на кухню'
                  )}
                </button>
                <p className="rm-payment-note">Оплата — официанту или на кассе после подачи</p>
              </>
            )}
          </section>
        </div>
      )}

      {/* Шторка подробной информации о блюде (A4) */}
      {detailProduct && (
        <div
          className="rm-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetailProduct(null)
          }}
        >
          <div className="rm-sheet rm-dish-detail-sheet" role="dialog" aria-modal="true">
            <div className="rm-sheet-grip" />
            <button
              className="rm-sheet-close"
              onClick={() => setDetailProduct(null)}
              aria-label="Закрыть"
            >
              <Icon name="close" size={20} />
            </button>

            {detailProduct.image_url && (
              <div className="rm-detail-image-box">
                <Image
                  src={detailProduct.image_url}
                  alt={detailProduct.name}
                  width={640}
                  height={400}
                  unoptimized
                  className="rm-detail-image"
                />
              </div>
            )}

            <div className="rm-detail-body">
              <div className="rm-detail-header">
                <h2>{detailProduct.name}</h2>
                <strong className="rm-detail-price">{formatUzs(detailProduct.price_uzs)}</strong>
              </div>

              <div className="rm-detail-meta">
                {detailProduct.portion && <span>Порция: {detailProduct.portion}</span>}
                {detailProduct.preparation_minutes && (
                  <span>Время: ~{detailProduct.preparation_minutes} мин</span>
                )}
              </div>

              {detailProduct.description && (
                <p className="rm-detail-desc">{detailProduct.description}</p>
              )}

              {detailProduct.ingredients && (
                <div className="rm-detail-section">
                  <h4>Ингредиенты:</h4>
                  <p>{detailProduct.ingredients}</p>
                </div>
              )}

              {detailProduct.allergens && detailProduct.allergens.length > 0 && (
                <div className="rm-detail-section">
                  <h4>Содержит аллергены:</h4>
                  <div className="rm-allergens-tags">
                    {detailProduct.allergens.map((alg) => (
                      <span key={alg} className="rm-allergen-tag">
                        {alg}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rm-detail-note-box">
                <label htmlFor="dish-note">Пожелание к блюду:</label>
                <input
                  id="dish-note"
                  value={detailNote}
                  onChange={(e) => setDetailNote(e.target.value)}
                  placeholder="Например, без зелени или соус отдельно"
                  maxLength={240}
                />
              </div>

              <div className="rm-detail-actions">
                <button
                  className="rm-detail-add-btn"
                  onClick={() => {
                    changeQuantity(detailProduct, 1, detailNote)
                    setDetailProduct(null)
                  }}
                >
                  <Icon name="plus" size={17} />
                  <span>Добавить в заказ · {formatUzs(detailProduct.price_uzs)}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Шторка «Мои заказы» (A2) */}
      {ordersSheetOpen && (
        <div
          className="rm-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOrdersSheetOpen(false)
          }}
        >
          <div className="rm-sheet rm-orders-sheet" role="dialog" aria-modal="true">
            <div className="rm-sheet-grip" />
            <div className="rm-sheet-head">
              <h2>Мои заказы за этим столом</h2>
              <button
                className="rm-sheet-close"
                onClick={() => setOrdersSheetOpen(false)}
                aria-label="Закрыть"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="rm-orders-list">
              {allOrders.map((ord) => (
                <article key={ord.token} className="rm-order-history-card">
                  <div className="rm-order-history-top">
                    <strong>Заказ №{ord.orderNumber}</strong>
                    <span className={`rt-status rt-status-${ord.status}`}>
                      {ORDER_STATUS_LABELS[ord.status] ?? ord.status}
                    </span>
                  </div>
                  <div className="rm-order-history-info">
                    <span>{formatUzs(ord.totalUzs)}</span>
                    <time>{new Date(ord.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>
                  </div>
                  <Link
                    href={`/restaurant/order/${ord.token}`}
                    className="rm-order-history-link"
                    onClick={() => setOrdersSheetOpen(false)}
                  >
                    Открыть детали заказа →
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
