'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { ORDER_STATUS_LABELS, ORDER_STATUS_NEXT, type RestaurantOrderRow, type RestaurantOrderStatus, formatUzs } from '@/lib/restaurant/types'

type Table = { id: string; table_number: string; active: boolean; note: string | null }
type Category = { id: string; name: string; menu_products: { id: string; name: string; price_uzs: number; available: boolean; image_url: string | null; portion: string | null; is_popular: boolean; is_new: boolean }[] }
type Review = { id: string; rating: number; sentiment: string | null; comment: string | null; created_at: string; restaurant_orders: { order_number: number } | null; dining_tables: { table_number: string } | null }
type Member = { id: string; user_id: string; role: 'restaurant_admin'|'staff'|'kitchen'; full_name: string | null }
type Section = 'orders'|'kitchen'|'menu'|'tables'|'feedback'|'team'

export default function RestaurantAdminPanel({ restaurantId, slug, section }: { restaurantId: string; slug: string; section: Section }) {
  const [orders, setOrders] = useState<RestaurantOrderRow[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tableNumber, setTableNumber] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [staffRole, setStaffRole] = useState<Member['role']>('staff')
  const [categoryName, setCategoryName] = useState('')
  const [newProduct, setNewProduct] = useState({ category_id: '', name: '', price_uzs: '', description: '', portion: '', image_url: '' })
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [qrData, setQrData] = useState<Record<string, string>>({})
  const base = `/api/restaurant/admin/${restaurantId}`
  const load = useCallback(async () => {
    setError('')
    try {
      if (section === 'orders' || section === 'kitchen') { const response = await fetch(`${base}/orders`, { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setOrders(data) }
      if (section === 'tables') { const response = await fetch(`${base}/tables`, { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setTables(data) }
      if (section === 'menu') { const response = await fetch(`${base}/menu`, { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setCategories(data) }
      if (section === 'feedback') { const response = await fetch(`${base}/feedback`, { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setReviews(data) }
      if (section === 'team') { const response = await fetch(`${base}/staff`, { cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMembers(data) }
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить данные') }
  }, [base, section])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (section !== 'tables') return
    const origin = window.location.origin
    Promise.all(tables.map(async (table) => [table.id, await QRCode.toDataURL(`${origin}/restaurant/${slug}/table/${encodeURIComponent(table.table_number)}`, { width: 220, margin: 1, color: { dark: '#151714', light: '#ffffff' } })] as const)).then((pairs) => setQrData(Object.fromEntries(pairs))).catch(() => setError('Не удалось создать QR-коды'))
  }, [section, slug, tables])
  useEffect(() => { if (section === 'orders' || section === 'kitchen') { const timer = setInterval(load, 8000); return () => clearInterval(timer) } }, [load, section])

  async function updateOrder(order: RestaurantOrderRow, status?: RestaurantOrderStatus, payment_method?: string) {
    setBusy(true); setError('')
    try { const response = await fetch(`${base}/orders`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id, status, payment_method }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось обновить заказ') }
    finally { setBusy(false) }
  }
  async function toggleProduct(product: Category['menu_products'][number]) {
    const response = await fetch(`${base}/menu`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: product.id, available: !product.available }) }); if (!response.ok) { const data = await response.json(); setError(data.error ?? 'Не удалось обновить блюдо') } else load()
  }
  async function updatePrice(product: Category['menu_products'][number]) {
    const price = Number(priceDrafts[product.id] ?? product.price_uzs)
    if (!Number.isInteger(price) || price < 0) { setError('Цена должна быть целым числом в сумах'); return }
    const response = await fetch(`${base}/menu`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: product.id, price_uzs: price }) })
    const data = await response.json()
    if (!response.ok) setError(data.error ?? 'Не удалось обновить цену')
    else { setPriceDrafts((drafts) => { const next = { ...drafts }; delete next[product.id]; return next }); load() }
  }
  async function createCategory(event: React.FormEvent) {
    event.preventDefault(); const response = await fetch(`${base}/menu`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'category', name: categoryName }) }); const data = await response.json()
    if (!response.ok) setError(data.error ?? 'Не удалось создать категорию')
    else { setCategoryName(''); await load() }
  }
  async function createProduct(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { const response = await fetch(`${base}/menu`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'product', ...newProduct, price_uzs: Number(newProduct.price_uzs) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setNewProduct((current) => ({ ...current, name: '', price_uzs: '', description: '', portion: '', image_url: '' })); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось добавить блюдо') }
    finally { setBusy(false) }
  }
  async function addTable(event: React.FormEvent) {
    event.preventDefault(); if (!tableNumber.trim()) return
    const response = await fetch(`${base}/tables`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table_number: tableNumber }) }); const data = await response.json(); if (!response.ok) setError(data.error); else { setTableNumber(''); load() }
  }
  async function toggleTable(table: Table) {
    const response = await fetch(`${base}/tables`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: table.id, active: !table.active }) }); if (!response.ok) { const data = await response.json(); setError(data.error) } else load()
  }

  const liveOrders = useMemo(() => orders.filter((order) => !['completed','cancelled'].includes(order.status)), [orders])
  const visibleOrders = section === 'kitchen' ? orders.filter((order) => ['new','accepted','preparing','ready'].includes(order.status)) : orders
  const title = { orders: 'Заказы', kitchen: 'Кухня', menu: 'Меню', tables: 'Столы и QR', feedback: 'Отзывы гостей', team: 'Команда ресторана' }[section]
  return <div className={`ra-panel ${section === 'kitchen' ? 'ra-kitchen' : ''}`}><div className="ra-title-row"><div><h1>{title}</h1><p>{section === 'kitchen' ? 'Очередь кухни · обновляется автоматически' : section === 'orders' ? 'Заказы гостей в зале и их оплата' : section === 'tables' ? 'Столы и QR-ссылки на меню' : section === 'menu' ? 'Блюда и доступность для гостей' : 'Оценки и комментарии гостей'}</p></div><button className="ra-refresh" onClick={load}>Обновить</button></div>{error && <div className="ra-error" role="alert">{error}</div>}
    {(section === 'orders' || section === 'kitchen') && <><div className="ra-summary"><span>{section === 'kitchen' ? 'В работе' : 'Активные заказы'}<strong>{liveOrders.length}</strong></span><span>Новые<strong>{orders.filter((order) => order.status === 'new').length}</strong></span><span>Сумма активных<strong>{formatUzs(liveOrders.reduce((sum, order) => sum + order.total_uzs, 0))}</strong></span></div><div className="ra-order-list">{orders.length === 0 && <div className="ra-empty">Пока нет заказов. Новые появятся здесь после сканирования QR-кода.</div>}{visibleOrders.map((order) => <article key={order.id} className={`ra-order ${order.status === 'new' ? 'is-new' : ''}`}><div className="ra-order-top"><strong>№{order.order_number} · стол {order.dining_tables?.table_number ?? '—'}</strong><span className={`ra-status status-${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span></div><time>{new Date(order.created_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</time><ul>{order.restaurant_order_items.map((item) => <li key={item.id}><span>{item.product_name} × {item.quantity}{item.note && <small> · {item.note}</small>}</span><strong>{formatUzs(item.line_total_uzs)}</strong></li>)}</ul>{order.customer_note && <p className="ra-customer-note">Комментарий: {order.customer_note}</p>}<div className="ra-order-bottom"><strong>{formatUzs(order.total_uzs)}</strong><span>{order.payment_status === 'paid' ? `Оплачено · ${order.payment_method}` : 'Не оплачено'}</span></div><div className="ra-actions">{ORDER_STATUS_NEXT[order.status] && <button disabled={busy} onClick={() => updateOrder(order, ORDER_STATUS_NEXT[order.status])}>{section === 'kitchen' ? ({ accepted: 'Начать готовить', preparing: 'Блюдо готово', ready: 'Передать гостю', delivered: 'Завершить заказ' } as Record<string,string>)[order.status] : `→ ${ORDER_STATUS_LABELS[ORDER_STATUS_NEXT[order.status]!]}`}</button>}{order.payment_status !== 'paid' && !['cancelled'].includes(order.status) && <select aria-label={`Записать оплату заказа ${order.order_number}`} defaultValue="" onChange={(event) => { if (event.target.value) updateOrder(order, undefined, event.target.value) }}><option value="" disabled>Записать оплату</option><option value="cash">Наличные</option><option value="card">Карта</option><option value="terminal">Терминал</option><option value="other">Другое</option></select>}</div></article>)}{section === 'kitchen' && visibleOrders.length === 0 && <div className="ra-empty">Кухня свободна. Новые заказы появятся автоматически.</div>}</div></>}
    {section === 'menu' && <><div className="ra-menu-tools"><form onSubmit={createCategory}><label htmlFor="new-category">Новая категория</label><input id="new-category" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={100} placeholder="Например, Завтраки" required /><button>Добавить категорию</button></form><form onSubmit={createProduct} className="ra-product-form"><h2>Новое блюдо</h2><label htmlFor="product-category">Категория</label><select id="product-category" required value={newProduct.category_id || categories[0]?.id || ''} onChange={(event) => setNewProduct((current) => ({ ...current, category_id: event.target.value }))}><option value="" disabled>Выберите категорию</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><label htmlFor="product-name">Название</label><input id="product-name" required maxLength={100} value={newProduct.name} onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} /><label htmlFor="product-price">Цена, сум</label><input id="product-price" type="number" min="0" step="1" required value={newProduct.price_uzs} onChange={(event) => setNewProduct((current) => ({ ...current, price_uzs: event.target.value }))} /><label htmlFor="product-description">Описание</label><input id="product-description" maxLength={600} value={newProduct.description} onChange={(event) => setNewProduct((current) => ({ ...current, description: event.target.value }))} /><label htmlFor="product-portion">Порция</label><input id="product-portion" maxLength={40} value={newProduct.portion} onChange={(event) => setNewProduct((current) => ({ ...current, portion: event.target.value }))} placeholder="300 г" /><label htmlFor="product-image">Фото по HTTPS-ссылке</label><input id="product-image" type="url" value={newProduct.image_url} onChange={(event) => setNewProduct((current) => ({ ...current, image_url: event.target.value }))} placeholder="https://…" /><button disabled={busy || !categories.length}>{busy ? 'Сохраняем…' : 'Добавить блюдо'}</button></form></div><div className="ra-menu">{categories.map((category) => <section key={category.id}><h2>{category.name}</h2>{category.menu_products.map((product) => <article key={product.id} className="ra-menu-row">{product.image_url && <img src={product.image_url} alt="" /> }<div><strong>{product.name}</strong><span>{product.portion ?? 'Порция'}</span></div><label className="sr-only" htmlFor={`price-${product.id}`}>Цена блюда {product.name}</label><input id={`price-${product.id}`} className="ra-price-input" type="number" min="0" step="1" value={priceDrafts[product.id] ?? String(product.price_uzs)} onChange={(event) => setPriceDrafts((drafts) => ({ ...drafts, [product.id]: event.target.value }))} /><button className="ra-price-save" onClick={() => updatePrice(product)}>Сохранить цену</button><button className={product.available ? 'ra-available' : ''} onClick={() => toggleProduct(product)}>{product.available ? 'В меню' : 'Скрыто'}</button></article>)}</section>)}</div></>}
    {section === 'tables' && <><form onSubmit={addTable} className="ra-add-table"><label htmlFor="table-number">Добавить стол</label><input id="table-number" value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} maxLength={12} placeholder="Например, 9" /><button disabled={!tableNumber.trim()}>Добавить</button></form><div className="ra-tables">{tables.map((table) => <article className="ra-table" key={table.id}><strong>Стол {table.table_number}</strong><span>{table.active ? 'Активен' : 'Отключён'}</span>{qrData[table.id] && <img src={qrData[table.id]} alt={`QR-код меню для стола ${table.table_number}`} /> }<code>/restaurant/{slug}/table/{table.table_number}</code><button onClick={() => toggleTable(table)}>{table.active ? 'Отключить' : 'Включить'}</button><button onClick={() => window.print()}>Печать QR</button></article>)}</div></>}
    {section === 'feedback' && <><div className="ra-summary"><span>Средняя оценка<strong>{reviews.length ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1) : '—'} / 5</strong></span><span>Всего отзывов<strong>{reviews.length}</strong></span></div><div className="ra-reviews">{!reviews.length && <div className="ra-empty">Отзывов пока нет. Гости смогут оценить заказ после получения.</div>}{reviews.map((review) => <article key={review.id}><div><strong>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</strong><time>{new Date(review.created_at).toLocaleDateString('ru-RU')}</time></div><p>{review.comment || 'Без комментария'}</p><small>Заказ №{review.restaurant_orders?.order_number ?? '—'} · стол {review.dining_tables?.table_number ?? '—'}</small></article>)}</div></>}
    {section === 'team' && <><form className="ra-add-table ra-staff-form" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setError(''); try { const response = await fetch(`${base}/staff`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: staffEmail, role: staffRole }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setStaffEmail(''); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось назначить роль') } finally { setBusy(false) } }}><label htmlFor="staff-email">Добавить аккаунт BirTapCard</label><input id="staff-email" type="email" required value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} placeholder="name@example.com" /><select aria-label="Роль сотрудника" value={staffRole} onChange={(event) => setStaffRole(event.target.value as Member['role'])}><option value="staff">Сотрудник зала</option><option value="kitchen">Кухня</option><option value="restaurant_admin">Администратор</option></select><button disabled={busy || !staffEmail.trim()}>{busy ? 'Сохраняем…' : 'Назначить доступ'}</button><small>Аккаунт должен быть зарегистрирован в BirTapCard.</small></form><div className="ra-reviews">{!members.length && <div className="ra-empty">Пока нет назначенных сотрудников.</div>}{members.map((member) => <article className="ra-member" key={member.id}><div><strong>{member.full_name || 'Пользователь'}</strong><span>{member.role === 'restaurant_admin' ? 'Администратор ресторана' : member.role === 'kitchen' ? 'Кухня' : 'Сотрудник зала'}</span></div><code>{member.user_id}</code><button disabled={busy} onClick={async () => { const response = await fetch(`${base}/staff?user_id=${member.user_id}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok) setError(data.error); else load() }}>Убрать доступ</button></article>)}</div></>}
  </div>
}
