'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ORDER_STATUS_LABELS, type RestaurantOrderStatus, formatUzs } from '@/lib/restaurant/types'

type OrderData = { order_number: number; status: RestaurantOrderStatus; payment_status: string; total_uzs: number; created_at: string; restaurants: { name: string; slug: string } | null; dining_tables: { table_number: string } | null; restaurant_order_items: { product_name: string; quantity: number; line_total_uzs: number }[] }
const stages: RestaurantOrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'delivered', 'completed']

export default function OrderTracking({ token }: { token: string }) {
  const [order, setOrder] = useState<OrderData | null>(null)
  const [error, setError] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [reviewError, setReviewError] = useState('')
  useEffect(() => {
    let active = true
    const load = async () => { try { const response = await fetch(`/api/restaurant/public/orders/${token}`, { cache: 'no-store' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); if (active) { setOrder(result); setError('') } } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Заказ не найден') } }
    load(); const timer = setInterval(load, 5000); return () => { active = false; clearInterval(timer) }
  }, [token])
  async function sendReview() { setReviewError(''); const response = await fetch('/api/restaurant/public/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, rating, comment }) }); const result = await response.json(); if (!response.ok) setReviewError(result.error ?? 'Не удалось отправить оценку'); else setReviewed(true) }
  if (error) return <main className="rt-page"><section className="rt-card"><h1>Заказ не найден</h1><p>{error}</p><Link href="/">На главную</Link></section></main>
  if (!order) return <main className="rt-page"><section className="rt-card"><p>Загружаем статус заказа…</p></section></main>
  const stage = order.status === 'cancelled' ? -1 : stages.indexOf(order.status)
  return <main className="rt-page"><section className="rt-card"><a href={order.restaurants && order.dining_tables ? `/restaurant/${order.restaurants.slug}/table/${order.dining_tables.table_number}` : '/'} className="rt-brand">BirTapCard · {order.restaurants?.name}</a><h1>Заказ №{order.order_number}</h1><p>Стол {order.dining_tables?.table_number}</p>{order.status === 'cancelled' ? <div className="rt-cancel">Заказ отменён. Обратитесь к сотруднику ресторана.</div> : <ol className="rt-steps">{stages.map((status, index) => <li key={status} className={index <= stage ? 'is-done' : ''}><span />{ORDER_STATUS_LABELS[status]}</li>)}</ol>}<div className="rt-items">{order.restaurant_order_items.map((item, index) => <div key={index}><span>{item.product_name} × {item.quantity}</span><strong>{formatUzs(item.line_total_uzs)}</strong></div>)}</div><div className="rt-total"><span>Итого · оплата на кассе</span><strong>{formatUzs(order.total_uzs)}</strong></div><p className="rt-refresh">Статус обновляется автоматически</p>{['delivered', 'completed'].includes(order.status) && <div className="rt-review"><h2>Как вам заказ?</h2>{reviewed ? <p>Спасибо за отзыв.</p> : <><div className="rt-stars" role="radiogroup" aria-label="Оценка">{[1,2,3,4,5].map((n) => <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} из 5`} className={rating >= n ? 'is-on' : ''} onClick={() => setRating(n)}>★</button>)}</div><textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="Комментарий (необязательно)" />{reviewError && <p role="alert">{reviewError}</p>}<button className="rt-send" disabled={!rating} onClick={sendReview}>Оставить отзыв</button></>}</div>}</section></main>
}
