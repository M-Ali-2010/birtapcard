'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icons'
import type { PublicProduct, PublicRestaurantMenu } from '@/lib/restaurant/types'
import { formatUzs } from '@/lib/restaurant/types'

type CartLine = { product: PublicProduct; quantity: number }

export default function RestaurantMenu({ menu }: { menu: PublicRestaurantMenu }) {
  const router = useRouter()
  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [selectedCategory, setSelectedCategory] = useState(menu.categories[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})
  const cartButtonRef = useRef<HTMLButtonElement>(null)
  const cartDialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!cartOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = cartDialogRef.current
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), textarea, input, select, a[href]',
    )
    focusable?.[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCartOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const currentFocusable = dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea, input, select, a[href]',
      )
      if (!currentFocusable?.length) return
      const first = currentFocusable[0]
      const last = currentFocusable[currentFocusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      if (cartButtonRef.current?.isConnected) cartButtonRef.current.focus()
      else document.getElementById('menu-search')?.focus()
    }
  }, [cartOpen])

  const lines = Object.values(cart)
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce((sum, line) => sum + line.product.price_uzs * line.quantity, 0)
  const visibleCategories = useMemo(() => menu.categories.map((category) => ({
    ...category,
    menu_products: category.menu_products.filter((product) => (
      !query || (product.name + ' ' + (product.description ?? '') + ' ' + (product.ingredients ?? ''))
        .toLowerCase()
        .includes(query.toLowerCase())
    )),
  })).filter((category) => category.menu_products.length > 0), [menu.categories, query])

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.rm-category'))
    if (!sections.length || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      const firstVisible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (firstVisible) setSelectedCategory(firstVisible.target.id.replace('category-', ''))
    }, { rootMargin: '-145px 0px -68% 0px' })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [visibleCategories])

  function change(product: PublicProduct, delta: number) {
    setCart((current) => {
      const next = { ...current }
      const quantity = (next[product.id]?.quantity ?? 0) + delta
      if (quantity <= 0) delete next[product.id]
      else next[product.id] = { product, quantity }
      return next
    })
  }

  async function submit() {
    if (!lines.length || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/restaurant/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: menu.restaurant.slug,
          table: menu.table.table_number,
          items: lines.map(({ product, quantity }) => ({
            product_id: product.id,
            quantity,
            modifier_ids: [],
          })),
          note,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Не удалось оформить заказ')
      router.push('/restaurant/order/' + result.tracking_token)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Проверьте подключение и попробуйте ещё раз')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="rm-page">
      <header className="rm-head">
        {menu.restaurant.cover_url && (
          <div
            className="rm-cover"
            aria-hidden="true"
            style={{ backgroundImage: 'linear-gradient(180deg, rgba(14, 15, 17, .14), var(--bg)), url("' + menu.restaurant.cover_url + '")' }}
          />
        )}
        <div className="rm-head-main">
          <div className="rm-brand">
            {menu.restaurant.logo_url && !failedImages.logo
              ? <Image src={menu.restaurant.logo_url} alt="" width={48} height={48} unoptimized onError={() => setFailedImages((images) => ({ ...images, logo: true }))} />
              : <span className="rm-mark" aria-hidden="true">{menu.restaurant.name.slice(0, 1)}</span>}
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
        </div>
      </header>

      <div className="rm-content">
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
            <button className="rm-search-clear" onClick={() => setQuery('')} aria-label="Очистить поиск">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {visibleCategories.length > 0 && (
          <nav className="rm-categories" aria-label="Категории меню">
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                className={selectedCategory === category.id ? 'is-selected' : ''}
                aria-pressed={selectedCategory === category.id}
                onClick={() => {
                  setSelectedCategory(category.id)
                  document.getElementById('category-' + category.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                {category.name}
              </button>
            ))}
          </nav>
        )}

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
                    {product.image_url && !failedImages[product.id]
                      ? <Image className="rm-product-image" src={product.image_url} alt="" width={640} height={420} sizes="(max-width: 760px) 112px, (max-width: 1100px) 45vw, 480px" loading={categoryIndex === 0 && productIndex < 2 ? 'eager' : 'lazy'} unoptimized onError={() => setFailedImages((images) => ({ ...images, [product.id]: true }))} />
                      : <div className="rm-product-placeholder" aria-hidden="true"><Icon name="restaurants" size={26} /></div>}
                    <div className="rm-product-info">
                      <div className="rm-product-top">
                        <h3>{product.name}</h3>
                        <div className="rm-product-tags">
                          {product.is_popular && <span className="is-popular">Хит</span>}
                          {!product.is_popular && product.is_new && <span className="is-new">Новинка</span>}
                        </div>
                      </div>
                      {product.description && <p>{product.description}</p>}
                      <div className="rm-product-meta">
                        {[product.portion, product.preparation_minutes ? product.preparation_minutes + ' мин' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div className="rm-product-bottom">
                        <strong>{formatUzs(product.price_uzs)}</strong>
                        {cart[product.id]
                          ? (
                            <div className="rm-stepper" aria-label={product.name + ', ' + cart[product.id].quantity + ' шт.'}>
                              <button aria-label={'Убрать ' + product.name} onClick={() => change(product, -1)}>
                                <Icon name="minus" size={15} />
                              </button>
                              <span aria-live="polite">{cart[product.id].quantity}</span>
                              <button aria-label={'Добавить ' + product.name} onClick={() => change(product, 1)}>
                                <Icon name="plus" size={15} />
                              </button>
                            </div>
                          )
                          : (
                            <button className="rm-add" onClick={() => change(product, 1)}>
                              <Icon name="plus" size={15} />
                              <span>Добавить</span>
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
              <Icon name="search" size={20} />
              <strong>{query ? 'Ничего не найдено' : 'Меню скоро появится'}</strong>
              <span>{query ? 'Попробуйте другое название или ингредиент.' : 'Пока в меню нет доступных блюд.'}</span>
              {query && <button onClick={() => setQuery('')}>Сбросить поиск</button>}
            </div>
          )}
        </div>
        <footer className="rm-footer">Меню и заказ от BirTapCard</footer>
      </div>

      {count > 0 && (
        <button className="rm-cart-bar" ref={cartButtonRef} onClick={() => setCartOpen(true)}>
          <span className="rm-cart-count">{count}</span>
          <span>Открыть заказ</span>
          <strong>{formatUzs(total)}</strong>
          <Icon name="chevronRight" size={18} />
        </button>
      )}

      {cartOpen && (
        <div
          className="rm-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCartOpen(false)
          }}
        >
          <section className="rm-cart" ref={cartDialogRef} role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <div className="rm-cart-grip" aria-hidden="true" />
            <div className="rm-cart-head">
              <div>
                <h2 id="cart-title">Ваш заказ</h2>
                <p>{count} {count === 1 ? 'позиция' : count < 5 ? 'позиции' : 'позиций'} · стол {menu.table.table_number}</p>
              </div>
              <button className="rm-cart-close" aria-label="Закрыть корзину" onClick={() => setCartOpen(false)}>
                <Icon name="close" size={19} />
              </button>
            </div>
            <div className="rm-cart-lines">
              {!lines.length && <div className="rm-cart-empty"><Icon name="restaurants" size={21} /><span>В заказе пока нет блюд.</span><button onClick={() => setCartOpen(false)}>Вернуться к меню</button></div>}
              {lines.map(({ product, quantity }) => (
                <div className="rm-cart-line" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <small>{formatUzs(product.price_uzs)} за шт.</small>
                  </div>
                  <div className="rm-cart-line-end">
                    <div className="rm-stepper">
                      <button aria-label={'Убрать ' + product.name} onClick={() => change(product, -1)}>
                        <Icon name="minus" size={14} />
                      </button>
                      <span aria-live="polite">{quantity}</span>
                      <button aria-label={'Добавить ' + product.name} onClick={() => change(product, 1)}>
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                    <strong>{formatUzs(product.price_uzs * quantity)}</strong>
                  </div>
                </div>
              ))}
            </div>
            <label className="rm-note">
              Комментарий к заказу
              <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Например, без лука" />
            </label>
            {error && <p className="rm-error" role="alert">{error}</p>}
            <div className="rm-cart-total"><span>Итого</span><strong>{formatUzs(total)}</strong></div>
            <button className="rm-submit" disabled={busy || !lines.length} onClick={submit}>
              {busy ? <><span className="rm-spinner" aria-hidden="true" />Оформляем заказ…</> : 'Отправить на кухню'}
            </button>
            <p className="rm-payment-note">Оплата — официанту или на кассе</p>
          </section>
        </div>
      )}
    </main>
  )
}
