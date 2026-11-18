'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  useEffect(() => {
    if (!cartOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setCartOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', closeOnEscape) }
  }, [cartOpen])
  const lines = Object.values(cart)
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)
  const total = lines.reduce((sum, line) => sum + line.product.price_uzs * line.quantity, 0)
  const visibleCategories = useMemo(() => menu.categories.map((category) => ({
    ...category,
    menu_products: category.menu_products.filter((product) => !query || `${product.name} ${product.description ?? ''} ${product.ingredients ?? ''}`.toLowerCase().includes(query.toLowerCase())),
  })).filter((category) => category.menu_products.length > 0), [menu.categories, query])

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
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/restaurant/public/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: menu.restaurant.slug, table: menu.table.table_number, items: lines.map(({ product, quantity }) => ({ product_id: product.id, quantity, modifier_ids: [] })), note }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Не удалось оформить заказ')
      router.push(`/restaurant/order/${result.tracking_token}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Проверьте подключение и попробуйте ещё раз') }
    finally { setBusy(false) }
  }

  return <main className="rm-page">
    <header className="rm-head">
      {menu.restaurant.cover_url && <div className="rm-cover" style={{ backgroundImage: `linear-gradient(180deg, transparent, #101210), url("${menu.restaurant.cover_url}")` }} />}
      <div className="rm-head-main"><div className="rm-brand">{menu.restaurant.logo_url ? <img src={menu.restaurant.logo_url} alt="" /> : <span className="rm-mark">{menu.restaurant.name.slice(0, 1)}</span>}<span>МЕНЮ · СТОЛ {menu.table.table_number}</span></div><h1>{menu.restaurant.name}</h1><p>{menu.restaurant.description}</p>{menu.restaurant.address && <small>{menu.restaurant.address}</small>}</div>
    </header>
    <div className="rm-search"><label className="sr-only" htmlFor="menu-search">Найти блюдо</label><input id="menu-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти блюдо или ингредиент" /></div>
    <nav className="rm-categories" aria-label="Категории меню">{visibleCategories.map((category) => <button key={category.id} className={selectedCategory === category.id ? 'is-selected' : ''} onClick={() => { setSelectedCategory(category.id); document.getElementById(`category-${category.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{category.name}</button>)}</nav>
    <div className="rm-menu-list">{visibleCategories.map((category) => <section key={category.id} id={`category-${category.id}`} className="rm-category"><h2>{category.name}</h2>{category.description && <p>{category.description}</p>}<div className="rm-products">{category.menu_products.map((product) => <article className="rm-product" key={product.id}>{product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <div className="rm-product-placeholder" aria-hidden="true" /> }<div className="rm-product-info"><div className="rm-product-top"><h3>{product.name}</h3>{product.is_popular && <span>Хит</span>}</div><p>{product.description}</p><small>{[product.portion, product.preparation_minutes ? `${product.preparation_minutes} мин` : null].filter(Boolean).join(' · ')}</small><div className="rm-product-bottom"><strong>{formatUzs(product.price_uzs)}</strong>{cart[product.id] ? <div className="rm-stepper"><button aria-label={`Убрать ${product.name}`} onClick={() => change(product, -1)}>−</button><span>{cart[product.id].quantity}</span><button aria-label={`Добавить ${product.name}`} onClick={() => change(product, 1)}>+</button></div> : <button className="rm-add" onClick={() => change(product, 1)}>Добавить</button>}</div></div></article>)}</div></section>)}</div>
    <footer className="rm-footer">Меню и заказ от BirTapCard</footer>
    {count > 0 && <button className="rm-cart-bar" onClick={() => setCartOpen(true)}><span>Корзина · {count}</span><strong>{formatUzs(total)}</strong></button>}
    {cartOpen && <div className="rm-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setCartOpen(false) }}><section className="rm-cart" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div className="rm-cart-head"><h2 id="cart-title">Ваш заказ</h2><button aria-label="Закрыть корзину" onClick={() => setCartOpen(false)}>×</button></div>{lines.map(({ product, quantity }) => <div className="rm-cart-line" key={product.id}><div><strong>{product.name}</strong><small>{formatUzs(product.price_uzs)} · {quantity} шт.</small></div><div className="rm-stepper"><button aria-label={`Убрать ${product.name}`} onClick={() => change(product, -1)}>−</button><span>{quantity}</span><button aria-label={`Добавить ${product.name}`} onClick={() => change(product, 1)}>+</button></div></div>)}<label className="rm-note">Комментарий к заказу<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Например, без лука" /></label>{error && <p className="rm-error" role="alert">{error}</p>}<div className="rm-cart-total"><span>Итого</span><strong>{formatUzs(total)}</strong></div><button className="rm-submit" disabled={busy} onClick={submit}>{busy ? 'Оформляем…' : 'Отправить на кухню'}</button><small className="rm-payment-note">Оплата — официанту или на кассе</small></section></div>}
  </main>
}
