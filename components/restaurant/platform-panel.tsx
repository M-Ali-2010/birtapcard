'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { formatUzs } from '@/lib/restaurant/types'

type Restaurant = { id: string; name: string; slug: string; active: boolean; is_published: boolean; orders: number; members: number; revenue: number; subscription: { status: string } | null }

export default function RestaurantPlatformPanel({ restaurants }: { restaurants: Restaurant[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', slug: '', address: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch('/api/restaurant/admin/platform', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Не удалось создать ресторан')
      setForm({ name: '', slug: '', address: '', phone: '' }); router.push(`/restaurant-admin/${data.id}/menu`); router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось создать ресторан') }
    finally { setBusy(false) }
  }
  async function publish(item: Restaurant) {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/restaurant/admin/platform', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, is_published: !item.is_published }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Не удалось изменить публикацию')
      router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось изменить ресторан') }
    finally { setBusy(false) }
  }
  return <main className="ra-platform"><div className="ra-title-row"><div><h1>Ресторанная сеть</h1><p>Подключение новых заведений и обзор активности.</p></div><Link className="ra-refresh" href="/restaurant-admin">Мои рестораны</Link></div>{error && <p className="ra-error" role="alert">{error}</p>}<form className="ra-create-restaurant" onSubmit={submit}><h2>Подключить ресторан</h2><div className="ra-create-grid"><label>Название<input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Например, Cafe Example" /></label><label>Адрес страницы<input required maxLength={90} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="cafe-example" /></label><label>Адрес<input maxLength={240} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ташкент, улица…" /></label><label>Телефон<input type="tel" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998…" /></label></div><button disabled={busy}>{busy ? 'Создаём…' : 'Создать ресторан'}</button><small>Будет создан черновик и стол 1. Перед публикацией добавьте блюдо и назначьте администратора.</small></form><div className="ra-summary"><span>Ресторанов<strong>{restaurants.length}</strong></span><span>Активны<strong>{restaurants.filter((item) => item.active).length}</strong></span><span>Заказы<strong>{restaurants.reduce((sum, item) => sum + item.orders, 0)}</strong></span><span>Записанные оплаты<strong>{formatUzs(restaurants.reduce((sum, item) => sum + item.revenue, 0))}</strong></span></div><div className="ra-platform-list">{restaurants.map((item) => <article key={item.id}><div><h2>{item.name}{item.slug === 'bella-italia' && <small>СИНТЕТИЧЕСКОЕ ДЕМО</small>}</h2><code>{item.slug}</code></div><div><span>Статус</span><strong>{!item.active ? 'Отключён' : item.is_published ? 'Опубликован' : 'Черновик'}</strong></div><div><span>Подписка</span><strong>{item.subscription?.status ?? 'Не настроена'}</strong></div><div><span>Заказы · команда</span><strong>{item.orders} · {item.members}</strong></div><div><span>Оплаты</span><strong>{formatUzs(item.revenue)}</strong></div><div className="ra-platform-actions"><button disabled={busy || !item.active} onClick={() => publish(item)}>{item.is_published ? 'Снять с публикации' : 'Опубликовать'}</button><Link href={`/restaurant-admin/${item.id}/menu`}>Управлять</Link></div></article>)}</div></main>
}
