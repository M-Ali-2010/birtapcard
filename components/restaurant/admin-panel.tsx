'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RestaurantOrderRow, RestaurantOrderStatus, RestaurantRole } from '@/lib/restaurant/types'
import {
  OrdersSection,
  KitchenSection,
  MenuSection,
  TablesSection,
  FeedbackSection,
  TeamSection,
  type Table,
  type Category,
  type Review,
  type Member,
} from './admin-sections'

type Section = 'orders' | 'kitchen' | 'menu' | 'tables' | 'feedback' | 'team'

export default function RestaurantAdminPanel({
  restaurantId,
  slug,
  section,
  role = 'restaurant_admin',
}: {
  restaurantId: string
  slug: string
  section: Section
  role?: RestaurantRole
}) {
  const [orders, setOrders] = useState<RestaurantOrderRow[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const base = `/api/restaurant/admin/${restaurantId}`

  const load = useCallback(async () => {
    setError('')
    try {
      if (section === 'orders' || section === 'kitchen') {
        const response = await fetch(`${base}/orders`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setOrders(data)
      }
      if (section === 'tables') {
        const response = await fetch(`${base}/tables`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setTables(data)
      }
      if (section === 'menu') {
        const response = await fetch(`${base}/menu`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setCategories(data)
      }
      if (section === 'feedback') {
        const response = await fetch(`${base}/feedback`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setReviews(data)
      }
      if (section === 'team') {
        const response = await fetch(`${base}/staff`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        setMembers(data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить данные')
    } finally {
      setHasLoaded(true)
    }
  }, [base, section])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (section === 'orders' || section === 'kitchen') {
      const timer = setInterval(load, 6000)
      return () => clearInterval(timer)
    }
  }, [load, section])

  async function updateOrder(
    order: RestaurantOrderRow,
    status?: RestaurantOrderStatus,
    paymentMethod?: string,
  ) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${base}/orders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          status,
          payment_method: paymentMethod,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обновить заказ')
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<Section, { title: string; subtitle: string }> = {
    orders: {
      title: 'Заказы гостей',
      subtitle: 'Приём заказов в зале, отслеживание статуса и безопасная фиксация оплаты',
    },
    kitchen: {
      title: 'Кухня (KDS)',
      subtitle: 'Планшетный интерфейс поваров · автоматическое обновление очереди',
    },
    menu: {
      title: 'Меню и стоп-лист',
      subtitle: 'Управление доступностью блюд, цены и категории',
    },
    tables: {
      title: 'Столы, QR и NFC',
      subtitle: 'QR-коды для печати и ссылки для NFC-меток каждого стола',
    },
    feedback: {
      title: 'Отзывы гостей',
      subtitle: 'Оценки, теги и комментарии после получения заказа',
    },
    team: {
      title: 'Команда ресторана',
      subtitle: 'Управление сотрудниками зала, кухни и администраторами',
    },
  }

  return (
    <div className={`ra-panel ${section === 'kitchen' ? 'ra-kitchen' : ''}`}>
      <div className="ra-title-row">
        <div>
          <h1>{titles[section].title}</h1>
          <p>{titles[section].subtitle}</p>
        </div>
        <button className="ra-refresh" onClick={load}>
          Обновить
        </button>
      </div>

      {error && (
        <div className="ra-error" role="alert">
          {error}
        </div>
      )}

      {!hasLoaded && (
        <div className="ra-loading-banner" role="status">
          <span className="rm-spinner" aria-hidden="true" />
          Загружаем данные…
        </div>
      )}

      {section === 'orders' && (
        <OrdersSection
          orders={orders}
          base={base}
          role={role}
          busy={busy}
          hasLoaded={hasLoaded}
          onUpdateOrder={updateOrder}
          onRefresh={load}
        />
      )}

      {section === 'kitchen' && (
        <KitchenSection
          orders={orders}
          busy={busy}
          hasLoaded={hasLoaded}
          onUpdateOrder={updateOrder}
        />
      )}

      {section === 'menu' && (
        <MenuSection
          categories={categories}
          base={base}
          busy={busy}
          onRefresh={load}
        />
      )}

      {section === 'tables' && (
        <TablesSection
          tables={tables}
          slug={slug}
          base={base}
          onRefresh={load}
        />
      )}

      {section === 'feedback' && (
        <FeedbackSection
          reviews={reviews}
          hasLoaded={hasLoaded}
        />
      )}

      {section === 'team' && (
        <TeamSection
          members={members}
          base={base}
          busy={busy}
          hasLoaded={hasLoaded}
          onRefresh={load}
        />
      )}
    </div>
  )
}
