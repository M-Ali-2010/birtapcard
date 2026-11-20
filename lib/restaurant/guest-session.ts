import type { GuestCartItem, GuestOrderSummary, GuestSessionData, RestaurantOrderStatus } from './types'

const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours
const STORAGE_PREFIX = 'rm:v1'

function getStorageKey(slug: string, table: string): string {
  return `${STORAGE_PREFIX}:${slug}:${table}`
}

const DEFAULT_SESSION: GuestSessionData = {
  cart: {},
  activeOrders: [],
  activeAllergenFilters: [],
  updatedAt: 0,
}

export function getGuestSession(slug: string, table: string): GuestSessionData {
  if (typeof window === 'undefined') return { ...DEFAULT_SESSION }
  try {
    const raw = window.localStorage.getItem(getStorageKey(slug, table))
    if (!raw) return { ...DEFAULT_SESSION }
    const parsed = JSON.parse(raw) as GuestSessionData
    const now = Date.now()
    // Expired session check
    if (now - (parsed.updatedAt || 0) > SESSION_TTL_MS) {
      window.localStorage.removeItem(getStorageKey(slug, table))
      return { ...DEFAULT_SESSION }
    }
    return {
      cart: parsed.cart || {},
      activeOrders: Array.isArray(parsed.activeOrders) ? parsed.activeOrders : [],
      activeAllergenFilters: Array.isArray(parsed.activeAllergenFilters) ? parsed.activeAllergenFilters : [],
      updatedAt: parsed.updatedAt || now,
    }
  } catch {
    // Safari Private Mode or storage quota fallback
    return { ...DEFAULT_SESSION }
  }
}

function persistGuestSession(slug: string, table: string, session: GuestSessionData): void {
  if (typeof window === 'undefined') return
  try {
    const updated = {
      ...session,
      updatedAt: Date.now(),
    }
    window.localStorage.setItem(getStorageKey(slug, table), JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('guest-session-change', { detail: { slug, table, session: updated } }))
  } catch {
    // Safe fail if storage is full or disabled
  }
}

export function saveGuestCart(slug: string, table: string, cart: Record<string, GuestCartItem>): void {
  const session = getGuestSession(slug, table)
  session.cart = cart
  persistGuestSession(slug, table, session)
}

export function clearGuestCart(slug: string, table: string): void {
  const session = getGuestSession(slug, table)
  session.cart = {}
  persistGuestSession(slug, table, session)
}

export function saveGuestAllergenFilters(slug: string, table: string, filters: string[]): void {
  const session = getGuestSession(slug, table)
  session.activeAllergenFilters = filters
  persistGuestSession(slug, table, session)
}

export function addGuestOrder(slug: string, table: string, order: GuestOrderSummary): void {
  const session = getGuestSession(slug, table)
  // Deduplicate by token
  const existing = session.activeOrders.filter((o) => o.token !== order.token)
  session.activeOrders = [order, ...existing]
  // Clear cart on successful order
  session.cart = {}
  persistGuestSession(slug, table, session)
}

export function updateGuestOrderStatus(
  slug: string,
  table: string,
  token: string,
  status: RestaurantOrderStatus,
): void {
  const session = getGuestSession(slug, table)
  session.activeOrders = session.activeOrders.map((o) =>
    o.token === token ? { ...o, status } : o,
  )
  persistGuestSession(slug, table, session)
}

export function getActiveOrderForBanner(slug: string, table: string): GuestOrderSummary | null {
  const session = getGuestSession(slug, table)
  // Find latest order that is still in progress (not completed, not cancelled)
  const active = session.activeOrders.find(
    (o) => !['completed', 'cancelled'].includes(o.status),
  )
  return active ?? null
}
